import logging
import time
import base64
import json
import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.depth_estimator import depth_estimator
from app.services.point_cloud import PointCloudGenerator
from app.services.room_measurement import room_measurement_service
from app.services.ruler_measurement import ruler_measurement_service
from app.services.aicte_checker import aicte_checker
from app.models.schemas import FrameProcessingResponse

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/ws/video")
async def websocket_video_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket client connected to /ws/video")

    try:
        while True:
            # Receive text data (JSON payload containing base64 encoded frame)
            data_str = await websocket.receive_text()
            start_time = time.time()

            try:
                payload = json.loads(data_str)
                frame_b64 = payload.get("frame", "")
                mode = payload.get("mode", "ruler")  # 'ruler' or 'room'
                expected_cm = float(payload.get("expected_cm", 15.0))
                room_type = payload.get("room_type", "classroom")
                points = payload.get("points") # Optional [[u1, v1], [u2, v2]]
                fx = float(payload.get("fx", 500.0))
                fy = float(payload.get("fy", 500.0))

                if not frame_b64:
                    await websocket.send_json({
                        "status": "error",
                        "message": "Empty frame data received."
                    })
                    continue

                # Strip base64 header if present
                if "," in frame_b64:
                    frame_b64 = frame_b64.split(",", 1)[1]

                img_bytes = base64.b64decode(frame_b64)
                np_arr = np.frombuffer(img_bytes, np.uint8)
                rgb_image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                if rgb_image is None:
                    await websocket.send_json({
                        "status": "error",
                        "message": "Failed to decode image frame."
                    })
                    continue

                # Predict depth map if model ready
                depth_map = None
                depth_heatmap = None

                if depth_estimator.is_ready:
                    depth_map = depth_estimator.predict_depth(rgb_image)
                    depth_heatmap = depth_estimator.get_depth_heatmap_b64(depth_map)

                ruler_result = None
                dimensions = None
                compliance_result = None

                if mode == "ruler":
                    # Perform 15 cm reference ruler measurement
                    ruler_result = ruler_measurement_service.measure_ruler(
                        rgb_image=rgb_image,
                        depth_map=depth_map,
                        expected_cm=expected_cm,
                        points=points,
                        fx=fx,
                        fy=fy
                    )
                else:
                    # Perform room 3D geometry plane measurement
                    if depth_map is not None:
                        pc_generator = PointCloudGenerator(fx=fx, fy=fy)
                        pcd = pc_generator.generate_point_cloud(rgb_image, depth_map, stride=3)
                        dimensions = room_measurement_service.estimate_room_dimensions(pcd)
                    else:
                        dimensions = room_measurement_service.estimate_room_dimensions(
                            PointCloudGenerator().generate_point_cloud(rgb_image, np.ones((rgb_image.shape[0], rgb_image.shape[1]), dtype=np.float32) * 2.0)
                        )
                        dimensions.notes.append("Depth model warming up.")

                    compliance_result = aicte_checker.check_compliance(dimensions, room_key=room_type)

                processing_time = round((time.time() - start_time) * 1000, 2)

                response = FrameProcessingResponse(
                    status="success",
                    timestamp=time.time(),
                    mode=mode,
                    dimensions=dimensions,
                    aicte_compliance=compliance_result,
                    ruler_measurement=ruler_result,
                    depth_heatmap_b64=depth_heatmap,
                    processing_time_ms=processing_time
                )

                await websocket.send_text(response.model_dump_json())

            except Exception as e:
                logger.error(f"Error processing WebSocket frame: {e}", exc_info=True)
                await websocket.send_json({
                    "status": "error",
                    "message": f"Frame processing error: {str(e)}"
                })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket endpoint exception: {e}")
