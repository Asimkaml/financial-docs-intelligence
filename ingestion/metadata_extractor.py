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

_QUARTER_RE = re.compile(r"Q([1-4])", re.IGNORECASE)
_YEAR_RE = re.compile(r"(20\d{2})")


@dataclass
class FilingMetadata:
    company: str
    period_type: str      # "annual" | "quarterly"
    fiscal_period: str    # e.g. "FY2024", "Q2FY2024"
    currency: str = "PKR"


def infer_metadata(pdf_path, source_name: str, default_currency: str = "PKR") -> FilingMetadata:
    stem = Path(source_name).stem
    tokens = re.split(r"[_\-\s]+", stem)

    year_match = _YEAR_RE.search(stem)
    quarter_match = _QUARTER_RE.search(stem)
    year = year_match.group(1) if year_match else "unknown"

    if quarter_match:
        period_type = "quarterly"
        fiscal_period = f"Q{quarter_match.group(1)}FY{year}"
    else:
        period_type = "annual"
        fiscal_period = f"FY{year}"

    name_tokens = []
    for tok in tokens:
        if _YEAR_RE.fullmatch(tok) or _QUARTER_RE.fullmatch(tok):
            break
        name_tokens.append(tok)
    company = " ".join(name_tokens).strip() or "Unknown Company"

    return FilingMetadata(
        company=company,
        period_type=period_type,
        fiscal_period=fiscal_period,
        currency=default_currency,
    )
