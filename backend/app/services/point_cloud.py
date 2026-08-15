import numpy as np
import open3d as o3d
import cv2
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class PointCloudGenerator:
    def __init__(self, fx: float = 500.0, fy: float = 500.0, cx: Optional[float] = None, cy: Optional[float] = None):
        self.fx = fx
        self.fy = fy
        self.cx = cx
        self.cy = cy

    def generate_point_cloud(
        self,
        rgb_image: np.ndarray,
        depth_map: np.ndarray,
        stride: int = 2
    ) -> o3d.geometry.PointCloud:
        """
        Converts RGB image and metric depth map into an Open3D PointCloud object.
        - rgb_image: uint8 array (H, W, 3) in BGR or RGB format
        - depth_map: float32 array (H, W) in meters
        - stride: downsampling stride for faster performance
        """
        h, w = depth_map.shape
        cx = self.cx if self.cx is not None else w / 2.0
        cy = self.cy if self.cy is not None else h / 2.0

        # Subsample grid for computational efficiency
        u_grid, v_grid = np.meshgrid(
            np.arange(0, w, stride),
            np.arange(0, h, stride)
        )

        z = depth_map[v_grid, u_grid]

        # Valid depth mask
        valid_mask = (z > 0.2) & (z < 25.0) & (~np.isnan(z)) & (~np.isinf(z))

        u_valid = u_grid[valid_mask]
        v_valid = v_grid[valid_mask]
        z_valid = z[valid_mask]

        if len(z_valid) == 0:
            return o3d.geometry.PointCloud()

        # Camera pinhole backprojection formula
        x_valid = (u_valid - cx) * z_valid / self.fx
        y_valid = (v_valid - cy) * z_valid / self.fy

        points = np.stack((x_valid, y_valid, z_valid), axis=-1)

        # Extract RGB colors
        if len(rgb_image.shape) == 3 and rgb_image.shape[2] == 3:
            rgb_rgb = cv2.cvtColor(rgb_image, cv2.COLOR_BGR2RGB)
            colors = rgb_rgb[v_valid, u_valid] / 255.0
        else:
            colors = np.tile(np.array([0.5, 0.5, 0.5]), (len(points), 1))

        # Create Open3D PointCloud
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)
        pcd.colors = o3d.utility.Vector3dVector(colors)

        # Remove statistical noise outliers if sufficient points
        if len(points) > 100:
            try:
                pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
            except Exception as e:
                logger.debug(f"Statistical outlier removal skipped: {e}")

        return pcd

