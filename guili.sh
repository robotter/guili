#!/bin/bash
PYTHONPATH=../robotter/:../eurobot/:../avarix/bootloader python/guili.py --web-dir web/ --xbee-api /dev/ttyUSB0 1234 galipeur:20 galipette:21 boom:10 pano:aa
