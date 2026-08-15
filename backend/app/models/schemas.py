from pydantic import BaseModel, Field
from typing import Dict, Optional, Any, List

class RoomRequirement(BaseModel):
    name: str
    description: str
    min_length_m: float = Field(..., description="Minimum required room length in meters")
    min_width_m: float = Field(..., description="Minimum required room width in meters")
    min_height_m: float = Field(..., description="Minimum required room height in meters")
    min_area_sqm: float = Field(..., description="Minimum required floor area in square meters")
    is_placeholder: bool = True
    disclaimer: str = "Demo preset values for AICTE compliance check. Configurable via API/UI."

class DimensionStatus(BaseModel):
    measured: float = Field(..., description="Measured dimension in meters or square meters")
    required: float = Field(..., description="Required minimum dimension")
    unit: str = Field(default="m", description="Unit of measurement ('m' or 'm²')")
    status: str = Field(..., description="'PASS', 'FAIL', or 'UNRELIABLE'")
    difference_m: float = Field(..., description="Difference: measured - required")

class AICTEComplianceResult(BaseModel):
    overall_status: str = Field(..., description="'PASS', 'FAIL', or 'UNRELIABLE'")
    room_type: str
    room_name: str
    length: DimensionStatus
    width: DimensionStatus
    height: DimensionStatus
    area: DimensionStatus
    is_demo_placeholder: bool = True

class MeasuredDimensions(BaseModel):
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    height_m: Optional[float] = None
    area_sqm: Optional[float] = None
    room_length: Optional[float] = None
    room_width: Optional[float] = None
    ceiling_height: Optional[float] = None
    floor_area: Optional[float] = None
    confidence: float = Field(default=1.0, description="Confidence score from 0.0 to 1.0")
    reliable: bool = Field(default=True, description="True if geometry detection was confident and reliable")
    notes: List[str] = Field(default_factory=list)

class RulerMeasurementResult(BaseModel):
    object_name: str = Field(default="Reference Ruler")
    expected_cm: float = Field(default=15.0, description="Target reference length in cm")
    measured_cm: Optional[float] = Field(default=None, description="Measured real-world length in cm")
    error_percent: Optional[float] = Field(default=None, description="Percentage measurement error")
    confidence: float = Field(default=0.0, description="Detection confidence (0.0 to 1.0)")
    status: str = Field(default="SEARCHING", description="'PASS', 'FAIL', 'UNRELIABLE', or 'SEARCHING'")
    reliable: bool = Field(default=False)
    notes: List[str] = Field(default_factory=list)
    annotated_frame_b64: Optional[str] = None

class FrameProcessingResponse(BaseModel):
    status: str = Field(default="success")
    timestamp: float
    mode: str = Field(default="ruler", description="'ruler' or 'room'")
    dimensions: Optional[MeasuredDimensions] = None
    aicte_compliance: Optional[AICTEComplianceResult] = None
    ruler_measurement: Optional[RulerMeasurementResult] = None
    depth_heatmap_b64: Optional[str] = None
    processing_time_ms: float

class RequirementsUpdateRequest(BaseModel):
    room_key: str
    requirements: RoomRequirement
