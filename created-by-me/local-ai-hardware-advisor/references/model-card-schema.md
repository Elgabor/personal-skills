# Normalized model-card schema

Use this schema as the boundary between source collection and compatibility
estimation. It records facts without pretending that a missing field is a
requirement. JSON numbers use their stated unit; `*_b` means billions of
parameters and `*_bytes` means bytes.

## Required identity

- `model_id`: exact producer/repository name and revision or version.
- `model_card_url`: official model card or official repository URL.
- `model_card_date`: date shown by the source, or `null`.
- `producer`: original producer.
- `license`: exact license text/name, or `null`.
- `architecture`: `dense`, `moe`, or `unknown`.
- `parameters_b`: total parameters, or `null`.
- `active_parameters_b`: active parameters per token for MoE, otherwise
  `parameters_b` when known.
- `languages`: declared languages, or `[]` when not stated.
- `modalities`: declared values such as `text`, `vision`, `audio`, or
  `multimodal`.
- `declared_context_tokens`: the context window stated by the producer, or
  `null`.

## Architecture used for memory estimation

- `num_layers`
- `hidden_size`
- `num_attention_heads`
- `num_kv_heads`
- `head_dim`
- `kv_cache_dtype_bytes`: bytes per KV-cache element when declared or selected
  by the runtime.
- `batch_size`: requested concurrent sequences for the estimate.
- `requested_context_tokens`: context required by the user's task.

An estimator may derive `head_dim` as
`hidden_size / num_attention_heads` only when both values are declared and the
division is exact. It must mark that result as `STIMATO`.

## Artifact and runtime

- `format`: `safetensors`, `gguf`, `mlx`, `awq`, `gptq`, `exl2`, or another
  exact format.
- `conversion`: `{original_model, converter, converter_url, revision,
  provenance, confidence}` when the artifact is converted; otherwise `null`.
- `quantization`: exact label such as `Q4_K_M`, `Q8_0`, `4-bit`, `FP16`, or
  `null`.
- `weight_size_bytes`: measured or source-declared artifact size, or `null`.
- `quantization_bits`: numeric effective bits per weight when declared, or
  `null`.
- `backend_support`: declared backend/OS combinations, or `[]`.
- `declared_requirements`: producer requirements verbatim or structured, or
  `[]`.
- `limitations`: licensing, modality, language, context, or runtime limits.

## Provenance

Every material value should travel with a sibling provenance map:

```text
provenance.<field> = {
  source: "official_model_card | local_measurement | calculation | assumption",
  citation: "URL, command, or calculation name",
  certainty: "DICHIARATO | MISURATO | STIMATO | ASSUNTO | MANCANTE"
}
```

Use `official_model_card` for producer claims, `local_measurement` for a local
artifact or benchmark, `calculation` for formulas, and `assumption` only for a
clearly stated default. A converted artifact must never inherit the original
model's provenance for its file size, quantization, or backend support.

## Estimator inputs

The compatibility script needs, at minimum, `parameters_b` or
`weight_size_bytes`, an exact or labelled quantization, and a target context.
KV-cache sizing additionally needs `num_layers`, `num_kv_heads`, and
`head_dim`, or a producer/runtime-declared KV-cache size. If these are missing,
return `NON VERIFICABILE` for the affected claim rather than filling them with a
typical-model guess.
