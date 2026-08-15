import cv2
import numpy as np
import base64
import logging
from typing import Dict, Any, Tuple, Optional, List
from app.models.schemas import RulerMeasurementResult

logger = logging.getLogger(__name__)

class RulerMeasurementService:
    def __init__(self, tolerance_percent: float = 10.0):
        self.tolerance_percent = tolerance_percent

    def measure_ruler(
        self,
        rgb_image: np.ndarray,
        depth_map: Optional[np.ndarray],
        expected_cm: float = 15.0,
        points: Optional[List[Tuple[float, float]]] = None,
        fx: float = 500.0,
        fy: float = 500.0,
        cx: Optional[float] = None,
        cy: Optional[float] = None
    ) -> RulerMeasurementResult:
        """
        Estimates 3D real-world length using metric depth and pinhole intrinsics from user selected endpoints
        or fallback automatic ruler detection, computing error % and PASS/FAIL status against expected_cm.
        """
        h, w = rgb_image.shape[:2]
        cx = cx if cx is not None else w / 2.0
        cy = cy if cy is not None else h / 2.0

        notes: List[str] = []
        annotated_image = rgb_image.copy()

        # If user explicitly selected 2 endpoints on camera feed:
        if points is not None and len(points) == 2:
            pt1, pt2 = points[0], points[1]
            u1, v1 = int(pt1[0]), int(pt1[1])
            u2, v2 = int(pt2[0]), int(pt2[1])

            # Clamp coordinates to image bounds
            u1, v1 = max(0, min(w - 1, u1)), max(0, min(h - 1, v1))
            u2, v2 = max(0, min(w - 1, u2)), max(0, min(h - 1, v2))

            # Retrieve Metric Depth Z values (5x5 median neighborhood)
            if depth_map is not None:
                z1 = float(np.median(depth_map[max(0, v1-2):min(h, v1+3), max(0, u1-2):min(w, u1+3)]))
                z2 = float(np.median(depth_map[max(0, v2-2):min(h, v2+3), max(0, u2-2):min(w, u2+3)]))
            else:
                z1 = z2 = 1.0
                notes.append("Depth model warming up; using estimated 1.0m baseline depth.")

            if np.isnan(z1) or z1 <= 0.1: z1 = 1.0
            if np.isnan(z2) or z2 <= 0.1: z2 = 1.0

            # 3D Backprojection
            x1 = (u1 - cx) * z1 / fx
            y1 = (v1 - cy) * z1 / fy

            x2 = (u2 - cx) * z2 / fx
            y2 = (v2 - cy) * z2 / fy

            distance_m = np.sqrt((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2)
            measured_cm = round(float(distance_m * 100.0), 1)

            # Sanity clip to realistic range
            measured_cm = max(0.1, min(500.0, measured_cm))

            error_cm = abs(measured_cm - expected_cm)
            error_percent = round((error_cm / expected_cm) * 100.0, 1)

            status = "MEASURED"
            confidence = 0.90 if depth_map is not None else 0.50

            # Draw OpenCV annotations on frame
            cv2.line(annotated_image, (u1, v1), (u2, v2), (0, 230, 255), 3)
            cv2.circle(annotated_image, (u1, v1), 7, (0, 230, 255), -1)
            cv2.circle(annotated_image, (u2, v2), 7, (0, 230, 255), -1)
            cv2.circle(annotated_image, (u1, v1), 3, (0, 0, 0), -1)
            cv2.circle(annotated_image, (u2, v2), 3, (0, 0, 0), -1)

            cv2.putText(annotated_image, "1", (u1 + 8, v1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(annotated_image, "2", (u2 + 8, v2 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            label_text = f"3D Distance: {measured_cm} cm"
            cv2.putText(
                annotated_image,
                label_text,
                (max(10, min(u1, u2)), max(30, min(v1, v2) - 15)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                2,
                cv2.LINE_AA
            )

            return RulerMeasurementResult(
                object_name="Selected Endpoints",
                expected_cm=expected_cm,
                measured_cm=measured_cm,
                error_percent=None,
                confidence=round(confidence, 2),
                status=status,
                reliable=True,
                notes=notes,
                annotated_frame_b64=self._encode_b64(annotated_image)
            )


        # 1. Preprocess frame: Convert to Grayscale & apply Gaussian blur
        gray = cv2.cvtColor(rgb_image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # 2. Multi-strategy edge & threshold detection
        # Otsu thresholding + Canny edge detection
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        edges = cv2.Canny(blurred, 50, 150)
        combined_binary = cv2.bitwise_or(thresh, edges)

        # Morphological close to bridge small edge gaps
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        closed = cv2.morphologyEx(combined_binary, cv2.MORPH_CLOSE, kernel)

        # 3. Find candidate contours
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best_contour = None
        best_rect = None
        max_score = 0.0

        min_area = (h * w) * 0.002   # Ignore tiny noise (< 0.2% of frame)
        max_area = (h * w) * 0.70    # Ignore whole background frame

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area:
                continue

            rect = cv2.minAreaRect(cnt)
            (center), (w_box, h_box), angle = rect
            if w_box == 0 or h_box == 0:
                continue

            aspect_ratio = max(w_box, h_box) / min(w_box, h_box)

            # Ruler candidate: elongated shape (aspect ratio >= 1.8)
            if aspect_ratio >= 1.8:
                # Score based on area and elongation
                score = area * aspect_ratio
                if score > max_score:
                    max_score = score
                    best_contour = cnt
                    best_rect = rect

        # 4. If no ruler contour detected
        if best_rect is None:
            notes.append("No reference ruler / elongated object detected. Place a 15 cm ruler clearly on flat surface.")
            return RulerMeasurementResult(
                object_name="Reference Ruler",
                expected_cm=expected_cm,
                measured_cm=None,
                error_percent=None,
                confidence=0.10,
                status="SEARCHING",
                reliable=False,
                notes=notes,
                annotated_frame_b64=self._encode_b64(annotated_image)
            )

        # 5. Extract oriented bounding box corners & major axis endpoints
        box = cv2.boxPoints(best_rect)
        box = np.int32(box)

        # Determine major axis endpoints (longest pair of opposite side midpoints or major corners)
        # Sort box points along longer dimension
        pt0, pt1, pt2, pt3 = box[0], box[1], box[2], box[3]
        dist_01 = np.linalg.norm(pt0 - pt1)
        dist_12 = np.linalg.norm(pt1 - pt2)

        if dist_01 > dist_12:
            mid1 = (pt0 + pt3) / 2.0
            mid2 = (pt1 + pt2) / 2.0
        else:
            mid1 = (pt0 + pt1) / 2.0
            mid2 = (pt3 + pt2) / 2.0

        u1, v1 = int(mid1[0]), int(mid1[1])
        u2, v2 = int(mid2[0]), int(mid2[1])

        # Clamp endpoint coordinates to valid image bounds
        u1, v1 = max(0, min(w - 1, u1)), max(0, min(h - 1, v1))
        u2, v2 = max(0, min(w - 1, u2)), max(0, min(h - 1, v2))

        # 6. Retrieve Metric Depth Z values
        if depth_map is not None:
            # Take median depth in 5x5 region around endpoints for stability
            z1 = float(np.median(depth_map[max(0, v1-2):min(h, v1+3), max(0, u1-2):min(w, u1+3)]))
            z2 = float(np.median(depth_map[max(0, v2-2):min(h, v2+3), max(0, u2-2):min(w, u2+3)]))
        else:
            # Fallback distance if depth model not loaded (1.0 meter)
            z1 = z2 = 1.0
            notes.append("Depth map warming up; using estimated 1.0m baseline depth.")

        if np.isnan(z1) or z1 <= 0.1: z1 = 1.0
        if np.isnan(z2) or z2 <= 0.1: z2 = 1.0

        # 7. 3D Camera Backprojection: X = (u - cx)*Z/fx, Y = (v - cy)*Z/fy
        x1 = (u1 - cx) * z1 / fx
        y1 = (v1 - cy) * z1 / fy

        x2 = (u2 - cx) * z2 / fx
        y2 = (v2 - cy) * z2 / fy

        # 3D Euclidean distance in meters -> convert to cm
        distance_m = np.sqrt((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2)
        measured_cm = round(float(distance_m * 100.0), 1)

        # Sanity clip to avoid wild outliers
        measured_cm = max(1.0, min(200.0, measured_cm))

        # 8. Calculate Error % and Compliance Status
        error_cm = abs(measured_cm - expected_cm)
        error_percent = round((error_cm / expected_cm) * 100.0, 1)

        is_pass = error_percent <= self.tolerance_percent
        status = "PASS" if is_pass else "FAIL"

        # 9. Compute Confidence Score
        confidence = 0.85 if depth_map is not None else 0.50
        if error_percent < 5.0:
            confidence = min(0.98, confidence + 0.10)

        confidence_val = round(confidence, 2)

        # 10. Draw Computer Vision Annotations on OpenCV Frame
        # Draw bounding box (Green for PASS, Red for FAIL)
        box_color = (0, 255, 0) if is_pass else (0, 0, 255)
        cv2.drawContours(annotated_image, [box], 0, box_color, 2)

        # Draw major axis measurement line
        cv2.line(annotated_image, (u1, v1), (u2, v2), (255, 255, 0), 2)
        cv2.circle(annotated_image, (u1, v1), 5, (0, 255, 255), -1)
        cv2.circle(annotated_image, (u2, v2), 5, (0, 255, 255), -1)

        # Metric text label banner
        label_text = f"Measured: {measured_cm} cm | Exp: {expected_cm} cm | Err: {error_percent}% [{status}]"
        cv2.putText(
            annotated_image,
            label_text,
            (max(10, u1 - 20), max(30, v1 - 15)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2,
            cv2.LINE_AA
        )

        return RulerMeasurementResult(
            object_name="Reference Ruler",
            expected_cm=expected_cm,
            measured_cm=measured_cm,
            error_percent=error_percent,
            confidence=confidence_val,
            status=status,
            reliable=True,
            notes=notes,
            annotated_frame_b64=self._encode_b64(annotated_image)
        )

    def _encode_b64(self, image: np.ndarray) -> str:
        _, buffer = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return base64.b64encode(buffer).decode('utf-8')

ruler_measurement_service = RulerMeasurementService()
