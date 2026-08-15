import pytest
from app.services.aicte_checker import AICTEComplianceChecker
from app.models.schemas import MeasuredDimensions

def test_aicte_compliance_pass():
    checker = AICTEComplianceChecker()
    # Measured dimensions exceeding classroom requirements (6x5x3, 66 sqm)
    measured = MeasuredDimensions(
        length_m=7.0,
        width_m=6.0,
        height_m=3.2,
        area_sqm=42.0,
        confidence=0.85,
        reliable=True,
        notes=[]
    )
    result = checker.check_compliance(measured, room_key="classroom")
    assert result.length.status == "PASS"
    assert result.width.status == "PASS"
    assert result.height.status == "PASS"

def test_aicte_compliance_fail():
    checker = AICTEComplianceChecker()
    # Width and height below requirements
    measured = MeasuredDimensions(
        length_m=6.5,
        width_m=3.5,  # required 5.0
        height_m=2.5, # required 3.0
        area_sqm=22.75, # required 66.0
        confidence=0.80,
        reliable=True,
        notes=[]
    )
    result = checker.check_compliance(measured, room_key="classroom")
    assert result.overall_status == "FAIL"
    assert result.length.status == "PASS"
    assert result.width.status == "FAIL"
    assert result.height.status == "FAIL"
    assert result.area.status == "FAIL"

def test_aicte_compliance_unreliable():
    checker = AICTEComplianceChecker()
    measured = MeasuredDimensions(
        length_m=None,
        width_m=None,
        height_m=None,
        area_sqm=None,
        confidence=0.10,
        reliable=False,
        notes=["Insufficient points"]
    )
    result = checker.check_compliance(measured, room_key="classroom")
    assert result.overall_status == "UNRELIABLE"
