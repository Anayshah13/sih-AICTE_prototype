import numpy as np
import open3d as o3d
import logging
from typing import Dict, Any, Tuple, List
from app.models.schemas import MeasuredDimensions

logger = logging.getLogger(__name__)

class RoomMeasurementService:
    def __init__(self, min_points: int = 200):
        self.min_points = min_points

    def estimate_room_dimensions(self, pcd: o3d.geometry.PointCloud) -> MeasuredDimensions:
        """
        Estimates room length, width, height, and area from an Open3D point cloud using RANSAC plane detection.
        Returns a MeasuredDimensions schema with reliability indicators and confidence score.
        """
        notes: List[str] = []
        
        # Check if point cloud has sufficient points
        points = np.asarray(pcd.points)
        if len(points) < self.min_points:
            notes.append(f"Insufficient 3D points detected ({len(points)} < {self.min_points}). Point camera towards open room space.")
            return MeasuredDimensions(
                length_m=None,
                width_m=None,
                height_m=None,
                area_sqm=None,
                confidence=0.10,
                reliable=False,
                notes=notes
            )

        try:
            # 1. Primary RANSAC plane segmentation to find major structural plane (floor/wall)
            plane_model, inliers = pcd.segment_plane(
                distance_threshold=0.08,
                ransac_n=3,
                num_iterations=1000
            )

            [a, b, c, d] = plane_model
            normal = np.array([a, b, c])
            normal = normal / np.linalg.norm(normal)

            inlier_count = len(inliers)
            inlier_ratio = inlier_count / float(len(points))

            # Filter plane inliers and remaining points
            inlier_cloud = pcd.select_by_index(inliers)
            outlier_cloud = pcd.select_by_index(inliers, invert=True)
            outlier_points = np.asarray(outlier_cloud.points)

            # 2. Determine point cloud spatial bounding box extents
            bbox = pcd.get_axis_aligned_bounding_box()
            extent = bbox.get_extent()  # [dx, dy, dz]

            # In camera coordinate system: X is right, Y is down, Z is forward depth
            # Width ~ X range, Height ~ Y range, Depth ~ Z range
            raw_width = float(extent[0])
            raw_height = float(extent[1])
            raw_length = float(extent[2])

            # Refine floor & height estimation using plane normal
            # Y vector is downward in standard camera frame, so floor normal vector is close to vertical (0, -1, 0)
            is_horizontal_plane = abs(normal[1]) > 0.6

            if is_horizontal_plane:
                # Primary plane is floor or ceiling
                floor_points = np.asarray(inlier_cloud.points)
                y_floor = np.mean(floor_points[:, 1])

                if len(outlier_points) > 50:
                    y_ceiling = np.min(outlier_points[:, 1])
                    estimated_height = float(abs(y_floor - y_ceiling))
                else:
                    estimated_height = raw_height

                # Projection of points onto floor plane to compute length & width
                floor_x = floor_points[:, 0]
                floor_z = floor_points[:, 2]

                estimated_width = float(np.percentile(floor_x, 95) - np.percentile(floor_x, 5))
                estimated_length = float(np.percentile(floor_z, 95) - np.percentile(floor_z, 5))
            else:
                # Primary plane is a wall plane
                notes.append("Primary plane detected is a vertical wall plane. Depth boundary estimation applied.")
                estimated_height = raw_height
                estimated_width = raw_width
                estimated_length = raw_length

            # Ensure positive dimensions and sanity bounding
            estimated_length = round(max(0.5, estimated_length), 2)
            estimated_width = round(max(0.5, estimated_width), 2)
            estimated_height = round(max(0.5, estimated_height), 2)
            estimated_area = round(estimated_length * estimated_width, 2)

            # Calculate confidence score
            confidence = 0.0
            if inlier_ratio > 0.25:
                confidence += 0.40
            elif inlier_ratio > 0.10:
                confidence += 0.25
            else:
                confidence += 0.10

            if len(points) > 1000:
                confidence += 0.30
            elif len(points) > 500:
                confidence += 0.20
            else:
                confidence += 0.10

            # Reasonable indoor dimensions check
            if 1.5 <= estimated_height <= 6.0 and 1.5 <= estimated_length <= 30.0 and 1.5 <= estimated_width <= 30.0:
                confidence += 0.30
            else:
                notes.append("Estimated room boundaries outside typical indoor range. Verification suggested.")

            confidence = round(min(1.0, max(0.0, confidence)), 2)

            # Reliability determination threshold
            reliable = confidence >= 0.50 and len(points) >= self.min_points

            if not reliable:
                notes.append("Measurement confidence is low (< 50%). Move camera around to capture floor corners.")

            return MeasuredDimensions(
                length_m=estimated_length,
                width_m=estimated_width,
                height_m=estimated_height,
                area_sqm=estimated_area,
                confidence=confidence,
                reliable=reliable,
                notes=notes
            )

        except Exception as e:
            logger.error(f"Error during room dimension estimation: {e}")
            notes.append(f"Geometry detection error: {str(e)}")
            return MeasuredDimensions(
                length_m=None,
                width_m=None,
                height_m=None,
                area_sqm=None,
                confidence=0.0,
                reliable=False,
                notes=notes
            )

room_measurement_service = RoomMeasurementService()
