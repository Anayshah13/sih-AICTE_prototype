import logging
import io
import base64
import time
import numpy as np
from PIL import Image
import cv2

logger = logging.getLogger(__name__)

class MetricDepthEstimator:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cpu"
        self.is_ready = False
        self.model_name = ""

    def load_model(self, model_id: str = "depth-anything/Depth-Anything-V2-Metric-Indoor-Large-hf"):
        logger.info(f"Loading Depth Anything V2 model: {model_id}...")
        self.model_name = model_id
        
        try:
            import torch
            from transformers import AutoImageProcessor, AutoModelForDepthEstimation

            if torch.cuda.is_available():
                self.device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"
                
            logger.info(f"Using compute device: {self.device}")

            # Attempt to load requested model
            try:
                self.processor = AutoImageProcessor.from_pretrained(model_id)
                self.model = AutoModelForDepthEstimation.from_pretrained(model_id).to(self.device)
                self.model.eval()
                self.is_ready = True
                logger.info(f"Successfully loaded model: {model_id}")
            except Exception as primary_exc:
                logger.warning(f"Could not load primary model {model_id}: {primary_exc}")
                # Fallback to small model if primary large fails (e.g., memory/network limitation)
                fallback_id = "depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf"
                logger.info(f"Attempting fallback model load: {fallback_id}")
                self.processor = AutoImageProcessor.from_pretrained(fallback_id)
                self.model = AutoModelForDepthEstimation.from_pretrained(fallback_id).to(self.device)
                self.model.eval()
                self.model_name = fallback_id
                self.is_ready = True
                logger.info(f"Successfully loaded fallback model: {fallback_id}")

        except Exception as e:
            logger.error(f"Failed to initialize depth estimator model: {e}")
            self.is_ready = False

    def predict_depth(self, rgb_image: np.ndarray) -> np.ndarray:
        """
        Input: RGB image array (H, W, 3) in uint8 format (0-255).
        Output: Depth map array (H, W) in float32 format representing distance in meters.
        """
        if not self.is_ready or self.model is None or self.processor is None:
            raise RuntimeError("Depth Estimator model is not loaded or ready.")

        import torch
        
        # Convert BGR (cv2 format) to PIL RGB
        if len(rgb_image.shape) == 3 and rgb_image.shape[2] == 3:
            pil_image = Image.fromarray(cv2.cvtColor(rgb_image, cv2.COLOR_BGR2RGB))
        else:
            pil_image = Image.fromarray(rgb_image)

        orig_w, orig_h = pil_image.size

        # Prepare inputs for depth estimation model
        inputs = self.processor(images=pil_image, return_tensors="pt").to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            predicted_depth = outputs.predicted_depth

        # Interpolate predicted depth to original image dimensions
        prediction = torch.nn.functional.interpolate(
            predicted_depth.unsqueeze(1),
            size=(orig_h, orig_w),
            mode="bicubic",
            align_corners=False,
        )

        depth_np = prediction.squeeze().cpu().numpy().astype(np.float32)
        # Ensure non-negative depths
        depth_np = np.clip(depth_np, 0.05, 50.0)
        return depth_np

    def get_depth_heatmap_b64(self, depth_map: np.ndarray) -> str:
        """
        Converts float32 depth map (in meters) to colorized JPEG base64 string for visualization overlay.
        """
        # Normalize 0.5m to 10.0m for visualization contrast
        depth_visual = np.clip(depth_map, 0.5, 10.0)
        depth_norm = cv2.normalize(depth_visual, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
        depth_colormap = cv2.applyColorMap(depth_norm, cv2.COLORMAP_INFERNO)
        
        _, buffer = cv2.imencode('.jpg', depth_colormap, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        b64_str = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/jpeg;base64,{b64_str}"

# Global singleton instance
depth_estimator = MetricDepthEstimator()
