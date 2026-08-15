import os
from typing import Dict, Any, List

class Settings:
    APP_NAME: str = "Digital Dimension Tracking Backend"
    VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")

    # Depth model configuration
    # Options: 
    # - depth-anything/Depth-Anything-V2-Metric-Indoor-Large-hf
    # - depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf
    MODEL_ID: str = os.getenv("DEPTH_MODEL_ID", "depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf")
    MODEL_FALLBACK_ID: str = "depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf"
    
    # Processing settings
    MAX_PROCESSING_WIDTH: int = 640
    MAX_PROCESSING_HEIGHT: int = 480
    DEFAULT_FX: float = 500.0
    DEFAULT_FY: float = 500.0
    
    # Minimum detection confidence threshold (0.0 to 1.0)
    CONFIDENCE_THRESHOLD: float = 0.50

    # Configurable AICTE Infrastructure Requirement Standards (Placeholders / Demo Presets)
    DEFAULT_ROOM_REQUIREMENTS: Dict[str, Dict[str, Any]] = {
        "classroom": {
            "name": "Instructional Classroom",
            "description": "Standard AICTE undergraduate instructional classroom space",
            "min_length_m": 6.0,
            "min_width_m": 5.0,
            "min_height_m": 3.0,
            "min_area_sqm": 66.0,
            "is_placeholder": True,
            "disclaimer": "Demo preset values for AICTE compliance check. Configurable via API/UI."
        },
        "computer_lab": {
            "name": "Computer Centre / Lab",
            "description": "AICTE Computer Center / Software Laboratory",
            "min_length_m": 10.0,
            "min_width_m": 7.5,
            "min_height_m": 3.0,
            "min_area_sqm": 75.0,
            "is_placeholder": True,
            "disclaimer": "Demo preset values for AICTE compliance check. Configurable via API/UI."
        },
        "seminar_hall": {
            "name": "Seminar Hall",
            "description": "Institutional Seminar / Conference Auditorium",
            "min_length_m": 12.0,
            "min_width_m": 10.0,
            "min_height_m": 3.5,
            "min_area_sqm": 132.0,
            "is_placeholder": True,
            "disclaimer": "Demo preset values for AICTE compliance check. Configurable via API/UI."
        },
        "workshop": {
            "name": "Workshop / Engineering Lab",
            "description": "Central Workshop or Machine Laboratory",
            "min_length_m": 12.0,
            "min_width_m": 8.0,
            "min_height_m": 3.5,
            "min_area_sqm": 100.0,
            "is_placeholder": True,
            "disclaimer": "Demo preset values for AICTE compliance check. Configurable via API/UI."
        },
        "faculty_room": {
            "name": "Faculty / HOD Cabin",
            "description": "Administrative Cabin or HOD Office Space",
            "min_length_m": 3.5,
            "min_width_m": 3.0,
            "min_height_m": 2.8,
            "min_area_sqm": 10.5,
            "is_placeholder": True,
            "disclaimer": "Demo preset values for AICTE compliance check. Configurable via API/UI."
        }
    }

settings = Settings()
