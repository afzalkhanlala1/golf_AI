#!/usr/bin/env bash
# Deploy the inference service to AWS Lambda (container image).
#
#   cd inference && ./deploy-aws.sh
#
# Idempotent: safe to re-run to ship an update. Reads credentials from the
# usual AWS sources (env vars, ~/.aws/credentials, SSO) — it never takes a
# key as an argument, so nothing secret ends up in your shell history.
#
# Prerequisites: awscli v2, docker running, and an AWS identity with the
# permissions in aws-iam-policy.json.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
FUNCTION="${FUNCTION_NAME:-golf-ai-inference}"
REPO="${ECR_REPO:-golf-ai-inference}"
MEMORY="${LAMBDA_MEMORY:-3008}"   # more memory also buys proportionally more CPU
TIMEOUT="${LAMBDA_TIMEOUT:-600}"

for tool in aws docker; do
  command -v "$tool" >/dev/null || { echo "error: $tool not found on PATH"; exit 1; }
done

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
[ -n "$ACCOUNT" ] || { echo "error: no AWS credentials configured"; exit 1; }
ECR="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE="${ECR}/${REPO}:latest"

echo "==> account ${ACCOUNT}, region ${REGION}"

# 1. ECR repository
aws ecr describe-repositories --repository-names "$REPO" --region "$REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO" --region "$REGION" >/dev/null

# A fresh ECR repo has no resource policy, and without one the Lambda
# *service* — not the deploying user, a separate principal — cannot pull the
# image at all: CreateFunction fails with "Lambda does not have permission
# to access the ECR image." IAM permissions on the deploying user do not
# cover this; it is a resource policy on the repository itself. Scoped to
# this account only via the SourceAccount condition, not open to any caller.
aws ecr set-repository-policy --repository-name "$REPO" --region "$REGION" --policy-text "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"LambdaECRImageRetrievalPolicy\",
    \"Effect\": \"Allow\",
    \"Principal\": { \"Service\": \"lambda.amazonaws.com\" },
    \"Action\": [\"ecr:BatchGetImage\", \"ecr:GetDownloadUrlForLayer\"],
    \"Condition\": { \"StringEquals\": { \"aws:SourceAccount\": \"${ACCOUNT}\" } }
  }]
}" >/dev/null
echo "==> ecr repo ready: ${REPO}"

# 2. Build and push. --provenance=false because Lambda rejects the extra
#    manifest buildx attaches by default.
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR" >/dev/null
docker build --platform linux/amd64 --provenance=false -t "$IMAGE" .
docker push "$IMAGE"
echo "==> pushed ${IMAGE}"

# 3. Execution role
ROLE_NAME="${FUNCTION}-role"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
    }' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null
  echo "==> created role ${ROLE_NAME}; waiting for propagation"
  sleep 12
fi
ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"

# The function invokes itself asynchronously to run the slow pass, so it
# needs InvokeFunction on its own ARN. Scoped to exactly that resource.
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name self-invoke \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":\"lambda:InvokeFunction\",
      \"Resource\":\"arn:aws:lambda:${REGION}:${ACCOUNT}:function:${FUNCTION}\"
    }]
  }" >/dev/null

# 4. Environment. Pulled from the repo-root .env.local so secrets stay in
#    one place and never appear on the command line.
ENV_FILE="../.env.local"
read_env() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }
SHARED_SECRET="$(read_env INFERENCE_SHARED_SECRET)"
BLOB_TOKEN="$(read_env BLOB_READ_WRITE_TOKEN)"
[ -n "$SHARED_SECRET" ] || { echo "error: INFERENCE_SHARED_SECRET missing from ${ENV_FILE}"; exit 1; }
[ -n "$BLOB_TOKEN" ] || { echo "error: BLOB_READ_WRITE_TOKEN missing from ${ENV_FILE}"; exit 1; }

# Built with bash rather than shelling out to python3: on Windows the bare
# `python3`/`python` commands are frequently a Microsoft Store alias stub
# that errors instead of running real Python (confirmed on this machine),
# and this JSON is simple enough not to need a language dependency at all.
json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
ENV_JSON="{\"Variables\":{\
\"INFERENCE_SHARED_SECRET\":\"$(json_escape "$SHARED_SECRET")\",\
\"BLOB_READ_WRITE_TOKEN\":\"$(json_escape "$BLOB_TOKEN")\",\
\"POSE_BACKEND\":\"mediapipe\",\
\"MEDIAPIPE_POSE_MODEL\":\"/var/task/models/pose_landmarker_full.task\",\
\"HOME\":\"/tmp\",\
\"XDG_CACHE_HOME\":\"/tmp\"\
}}"

# 5. Create or update
if aws lambda get-function --function-name "$FUNCTION" --region "$REGION" >/dev/null 2>&1; then
  echo "==> updating existing function"
  aws lambda update-function-code --function-name "$FUNCTION" --image-uri "$IMAGE" --region "$REGION" >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION" --region "$REGION"
  aws lambda update-function-configuration --function-name "$FUNCTION" \
    --memory-size "$MEMORY" --timeout "$TIMEOUT" --environment "$ENV_JSON" --region "$REGION" >/dev/null
else
  echo "==> creating function"
  aws lambda create-function --function-name "$FUNCTION" \
    --package-type Image --code "ImageUri=${IMAGE}" --role "$ROLE_ARN" \
    --memory-size "$MEMORY" --timeout "$TIMEOUT" --environment "$ENV_JSON" \
    --architectures x86_64 --region "$REGION" >/dev/null
fi
aws lambda wait function-updated --function-name "$FUNCTION" --region "$REGION"

# 6. Public Function URL. Auth is the shared secret the handler checks, which
#    is the same posture the Modal deployment had. AWS requires TWO resource
#    policies for AuthType=NONE: InvokeFunctionUrl (with auth-type condition)
#    AND InvokeFunction for principal * — see urls-auth.html.
if ! aws lambda get-function-url-config --function-name "$FUNCTION" --region "$REGION" >/dev/null 2>&1; then
  aws lambda create-function-url-config --function-name "$FUNCTION" \
    --auth-type NONE --region "$REGION" >/dev/null
fi
for sid_action in \
  "FunctionURLAllowPublicAccess:lambda:InvokeFunctionUrl" \
  "FunctionURLAllowPublicInvoke:lambda:InvokeFunction"; do
  sid="${sid_action%%:*}"
  action="${sid_action#*:}"
  if [ "$action" = "lambda:InvokeFunctionUrl" ]; then
    aws lambda add-permission --function-name "$FUNCTION" \
      --statement-id "$sid" --action "$action" \
      --principal '*' --function-url-auth-type NONE --region "$REGION" >/dev/null 2>&1 \
      || true
  else
    aws lambda add-permission --function-name "$FUNCTION" \
      --statement-id "$sid" --action "$action" \
      --principal '*' --region "$REGION" >/dev/null 2>&1 \
      || true
  fi
done
URL="$(aws lambda get-function-url-config --function-name "$FUNCTION" --region "$REGION" --query FunctionUrl --output text)"

echo
echo "================================================================"
echo " Deployed."
echo
echo " Set this in Vercel (and .env.local):"
echo "   INFERENCE_URL=${URL%/}"
echo "   INFERENCE_MODE=modal        # the HTTP contract is identical"
echo
echo " Verify:"
echo "   curl ${URL%/}/health"
echo "================================================================"
