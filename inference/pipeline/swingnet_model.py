"""
Minimal SwingNet EventDetector compatible with GolfDB-style checkpoints.

If SWINGNET_CHECKPOINT_URL points at a GolfDB `swingnet*.pth.tar` with a matching
state dict, events.py will use it. Otherwise the heuristic detector runs.
"""

from __future__ import annotations

import torch
import torch.nn as nn
from torch.nn import functional as F


def conv_bn(inp: int, oup: int, stride: int) -> nn.Sequential:
    return nn.Sequential(
        nn.Conv2d(inp, oup, 3, stride, 1, bias=False),
        nn.BatchNorm2d(oup),
        nn.ReLU6(inplace=True),
    )


def conv_1x1_bn(inp: int, oup: int) -> nn.Sequential:
    return nn.Sequential(
        nn.Conv2d(inp, oup, 1, 1, 0, bias=False),
        nn.BatchNorm2d(oup),
        nn.ReLU6(inplace=True),
    )


class InvertedResidual(nn.Module):
    def __init__(self, inp: int, oup: int, stride: int, expand_ratio: int):
        super().__init__()
        self.stride = stride
        hidden = int(inp * expand_ratio)
        self.use_res = self.stride == 1 and inp == oup
        layers = []
        if expand_ratio != 1:
            layers.append(conv_1x1_bn(inp, hidden))
        layers.extend(
            [
                nn.Conv2d(hidden, hidden, 3, stride, 1, groups=hidden, bias=False),
                nn.BatchNorm2d(hidden),
                nn.ReLU6(inplace=True),
                nn.Conv2d(hidden, oup, 1, 1, 0, bias=False),
                nn.BatchNorm2d(oup),
            ]
        )
        self.conv = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.use_res:
            return x + self.conv(x)
        return self.conv(x)


class MobileNetV2(nn.Module):
    def __init__(self, width_mult: float = 1.0):
        super().__init__()
        # t, c, n, s
        cfg = [
            [1, 16, 1, 1],
            [6, 24, 2, 2],
            [6, 32, 3, 2],
            [6, 64, 4, 2],
            [6, 96, 3, 1],
            [6, 160, 3, 2],
            [6, 320, 1, 1],
        ]
        input_channel = int(32 * width_mult)
        self.features = [conv_bn(3, input_channel, 2)]
        for t, c, n, s in cfg:
            output_channel = int(c * width_mult)
            for i in range(n):
                stride = s if i == 0 else 1
                self.features.append(
                    InvertedResidual(input_channel, output_channel, stride, t)
                )
                input_channel = output_channel
        self.features = nn.Sequential(*self.features)
        self.last_channel = int(1280 * width_mult) if width_mult > 1.0 else 1280
        self.conv = conv_1x1_bn(input_channel, self.last_channel)
        self.avgpool = nn.AdaptiveAvgPool2d(1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.conv(x)
        x = self.avgpool(x)
        return x.view(x.size(0), -1)


class EventDetector(nn.Module):
    def __init__(
        self,
        pretrain: bool = True,
        width_mult: float = 1.0,
        lstm_layers: int = 1,
        lstm_hidden: int = 256,
        bidirectional: bool = True,
        dropout: bool = True,
    ):
        super().__init__()
        self.cnn = MobileNetV2(width_mult=width_mult)
        self.rnn = nn.LSTM(
            self.cnn.last_channel,
            lstm_hidden,
            lstm_layers,
            batch_first=True,
            bidirectional=bidirectional,
        )
        self.dropout = nn.Dropout(0.2) if dropout else nn.Identity()
        feat = lstm_hidden * (2 if bidirectional else 1)
        self.lin = nn.Linear(feat, 9)  # 8 events + no-event

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, C, H, W) or (T, C, H, W)
        if x.dim() == 4:
            x = x.unsqueeze(0)
        b, t, c, h, w = x.shape
        x = x.view(b * t, c, h, w)
        f = self.cnn(x)
        f = f.view(b, t, -1)
        r, _ = self.rnn(f)
        r = self.dropout(r)
        return self.lin(r).view(b * t, -1)
