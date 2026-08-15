import logging
from typing import Dict, Any, Optional
from app.config import settings
from app.models.schemas import (
    RoomRequirement,
    DimensionStatus,
    AICTEComplianceResult,
    MeasuredDimensions
)

logger = logging.getLogger(__name__)

class AICTEComplianceChecker:
    def __init__(self):
        # Initialize configurable requirements from app settings
        self.requirements: Dict[str, Dict[str, Any]] = dict(settings.DEFAULT_ROOM_REQUIREMENTS)

    def get_all_requirements(self) -> Dict[str, Dict[str, Any]]:
        return self.requirements

    def get_requirement(self, room_key: str) -> Optional[Dict[str, Any]]:
        return self.requirements.get(room_key, self.requirements.get("classroom"))

    def update_requirement(self, room_key: str, requirement: RoomRequirement) -> Dict[str, Any]:
        req_dict = requirement.model_dump()
        self.requirements[room_key] = req_dict
        logger.info(f"Updated AICTE requirement for room profile: {room_key}")
        return req_dict

    def check_compliance(self, measured: MeasuredDimensions, room_key: str = "classroom") -> AICTEComplianceResult:
        req_data = self.get_requirement(room_key)
        if req_data is None:
            req_data = settings.DEFAULT_ROOM_REQUIREMENTS["classroom"]

        room_name = req_data.get("name", "Instructional Room")
        is_placeholder = req_data.get("is_placeholder", True)

        min_length = float(req_data.get("min_length_m", 6.0))
        min_width = float(req_data.get("min_width_m", 5.0))
        min_height = float(req_data.get("min_height_m", 3.0))
        min_area = float(req_data.get("min_area_sqm", 66.0))

        # Check if measurements are reliable
        if not measured.reliable or measured.length_m is None:
            unreliable_dim = DimensionStatus(
                measured=0.0,
                required=0.0,
                unit="m",
                status="UNRELIABLE",
                difference_m=0.0
            )
            return AICTEComplianceResult(
                overall_status="UNRELIABLE",
                room_type=room_key,
                room_name=room_name,
                length=unreliable_dim,
                width=unreliable_dim,
                height=unreliable_dim,
                area=DimensionStatus(measured=0.0, required=0.0, unit="m²", status="UNRELIABLE", difference_m=0.0),
                is_demo_placeholder=is_placeholder
            )

        m_length = measured.length_m or 0.0
        m_width = measured.width_m or 0.0
        m_height = measured.height_m or 0.0
        m_area = measured.area_sqm or (m_length * m_width)

        len_status = "PASS" if m_length >= min_length else "FAIL"
        wid_status = "PASS" if m_width >= min_width else "FAIL"
        hgt_status = "PASS" if m_height >= min_height else "FAIL"
        area_status = "PASS" if m_area >= min_area else "FAIL"

        overall = "PASS" if (len_status == "PASS" and wid_status == "PASS" and hgt_status == "PASS" and area_status == "PASS") else "FAIL"

        return AICTEComplianceResult(
            overall_status=overall,
            room_type=room_key,
            room_name=room_name,
            length=DimensionStatus(
                measured=round(m_length, 2),
                required=min_length,
                unit="m",
                status=len_status,
                difference_m=round(m_length - min_length, 2)
            ),
            width=DimensionStatus(
                measured=round(m_width, 2),
                required=min_width,
                unit="m",
                status=wid_status,
                difference_m=round(m_width - min_width, 2)
            ),
            height=DimensionStatus(
                measured=round(m_height, 2),
                required=min_height,
                unit="m",
                status=hgt_status,
                difference_m=round(m_height - min_height, 2)
            ),
            area=DimensionStatus(
                measured=round(m_area, 2),
                required=min_area,
                unit="m²",
                status=area_status,
                difference_m=round(m_area - min_area, 2)
            ),
            is_demo_placeholder=is_placeholder
        )

aicte_checker = AICTEComplianceChecker()
