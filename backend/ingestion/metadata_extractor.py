"""
Heuristic metadata extraction for a filing: company, period type
(annual/quarterly), fiscal period, and currency.

This is a filename-based first pass, not a document-understanding step --
"HBL_Q2_2024.pdf" -> company="HBL", period_type="quarterly",
fiscal_period="Q2FY2024". It is deliberately simple and will mislabel
inconsistently-named files; the UI should let a user correct these fields
before indexing rather than trusting them silently. Upgrading this to an
LLM-based extraction pass (reading the filing's cover page) is a natural
follow-up once the filename heuristic proves too weak on real uploads.
"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


