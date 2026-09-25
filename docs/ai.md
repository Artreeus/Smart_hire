# AI Design

SmartHire uses AI as an assistive layer rather than an automated decision maker.

## CV analysis

The server extracts text from uploaded documents and requests structured fields from OpenRouter. Prompts explicitly prohibit inference of protected traits and require evidence from the submitted CV.

## Job matching

Matching considers published skills, experience, and education. Responses include component scores, matching reasons, missing skills, and a plain-language explanation. Recruiters retain final responsibility for all decisions.

## Job safety

Safety analysis checks company completeness, suspicious links, payment language, duplicated or incomplete content, and unrealistic claims. A concerning result is labeled `Requires review`; the system never declares an employer fraudulent automatically.

## Fallback behavior

When OpenRouter is unavailable, deterministic matching and safety rules keep the application functional. Production monitoring should record provider failures, response validity, latency, model selection, and cost without storing sensitive CV text in logs.
