import pytest
import numpy as np
import cv2
from app.services.ruler_measurement import RulerMeasurementService

def test_ruler_measurement_searching():
    service = RulerMeasurementService()
    # Blank image (no rectangular object)
    blank_img = np.zeros((480, 640, 3), dtype=np.uint8)
    res = service.measure_ruler(blank_img, depth_map=None, expected_cm=15.0)

    assert res.status == "SEARCHING"
    assert res.reliable is False
    assert res.measured_cm is None

def test_ruler_measurement_detection():
    service = RulerMeasurementService(tolerance_percent=15.0)
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Draw a synthetic 15cm ruler-shaped white rectangle on dark background
    # Centered in frame
    cv2.rectangle(img, (200, 220), (440, 260), (245, 245, 245), -1)

    # Synthetic depth map of 1.0m constant distance
    depth_map = np.ones((480, 640), dtype=np.float32) * 1.0

    res = service.measure_ruler(img, depth_map=depth_map, expected_cm=15.0, fx=500.0, fy=500.0)

    assert res.reliable is True
    assert res.status in ["PASS", "FAIL"]
    assert res.measured_cm is not None
    assert res.error_percent is not None
    assert res.confidence > 0.5

def test_ruler_measurement_two_points():
    service = RulerMeasurementService(tolerance_percent=10.0)
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Synthetic depth map of 1.0m constant distance
    depth_map = np.ones((480, 640), dtype=np.float32) * 1.0

    # 15 cm physical separation at 1.0m depth with fx=500, cx=320, cy=240
    # u1 = 200 => x1 = (200-320)/500 = -0.24m
    # u2 = 275 => x2 = (275-320)/500 = -0.09m
    # dx = 0.15m = 15.0 cm
    points = [(200.0, 240.0), (275.0, 240.0)]

    res = service.measure_ruler(img, depth_map=depth_map, expected_cm=15.0, points=points, fx=500.0, fy=500.0)

    assert res.reliable is True
    assert res.status == "MEASURED"
    assert res.measured_cm == 15.0
    assert res.confidence >= 0.90

