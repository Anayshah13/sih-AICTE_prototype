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

            all_x = points[:, 0]
            all_y = points[:, 1]
            all_z = points[:, 2]

            # 2. Room Length & Width computation from 3D spatial point cloud extents
            estimated_length = float(np.percentile(all_z, 95) - np.percentile(all_z, 5))
            estimated_width = float(np.percentile(all_x, 95) - np.percentile(all_x, 5))

            estimated_length = round(max(0.5, estimated_length), 2)
            estimated_width = round(max(0.5, estimated_width), 2)

            # 3. Ceiling Height estimation from vertical Y-axis extent or floor/ceiling plane separation
            estimated_height = None
            is_horizontal_plane = abs(normal[1]) > 0.6

            if is_horizontal_plane:
                floor_points = np.asarray(inlier_cloud.points)
                y_floor = float(np.mean(floor_points[:, 1]))

                outlier_pts_arr = np.asarray(outlier_cloud.points)
                if len(outlier_pts_arr) >= 100:
                    try:
                        ceil_plane_model, ceil_inliers = outlier_cloud.segment_plane(
                            distance_threshold=0.08,
                            ransac_n=3,
                            num_iterations=500
                        )
                        [ca, cb, cc, cd] = ceil_plane_model
                        ceil_normal = np.array([ca, cb, cc])
                        ceil_normal = ceil_normal / np.linalg.norm(ceil_normal)

                        if abs(ceil_normal[1]) > 0.6 and len(ceil_inliers) >= 50:
                            ceil_cloud = outlier_cloud.select_by_index(ceil_inliers)
                            ceil_points = np.asarray(ceil_cloud.points)
                            y_ceiling = float(np.mean(ceil_points[:, 1]))
                            height_val = abs(y_floor - y_ceiling)

                            if 1.2 <= height_val <= 6.0:
                                estimated_height = round(float(height_val), 2)
                    except Exception:
                        pass

            if estimated_height is None:
                raw_height = float(np.percentile(all_y, 95) - np.percentile(all_y, 5))
                if 1.2 <= raw_height <= 6.0:
                    estimated_height = round(raw_height, 2)

            # 4. Floor Area calculation = Length x Width
            estimated_area = round(estimated_length * estimated_width, 2) if (estimated_length and estimated_width) else None

            reliable = len(points) >= self.min_points

            return MeasuredDimensions(
                length_m=estimated_length,
                width_m=estimated_width,
                height_m=estimated_height,
                area_sqm=estimated_area,
                confidence=1.0 if reliable else 0.50,
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
