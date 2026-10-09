import type { editor } from 'monaco-editor'
import type { JsonTransformAction, JsonTransformError, JsonTransformResponse } from './jsonTransformTypes'

type TransformRunner = (action: JsonTransformAction, text: string) => Promise<JsonTransformResponse>
export type ModelTransformResult =
  | { ok: true; changed: boolean; isValidJson: boolean }
  | { ok: false; error: JsonTransformError }

export function replaceModelText(model: editor.ITextModel, text: string): void {
  model.pushStackElement()
  model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null)
  model.pushStackElement()
}

// Validate every snapshot before committing either side of a comparison.
// Read each input only when needed and stop work if the workspace has moved on.
export async function transformModels(
  models: editor.ITextModel[],
  action: JsonTransformAction,
  run: TransformRunner,
  isCurrent: () => boolean
): Promise<ModelTransformResult | null> {
  const versions = models.map((model) => model.getAlternativeVersionId())
  const snapshotsAreCurrent = (): boolean => isCurrent() && models.every(
    (model, index) => !model.isDisposed() && model.getAlternativeVersionId() === versions[index]
  )
  const responses: Extract<JsonTransformResponse, { ok: true }>[] = []
  for (const model of models) {
    if (!snapshotsAreCurrent()) return null
    const response = await run(action, model.getValue())
    if (!snapshotsAreCurrent()) return null
    if (!response.ok) return { ok: false, error: response.error }
    responses.push(response)
  }

  responses.forEach((response, index) => {
    if (response.changed) replaceModelText(models[index]!, response.text)
  })
  return {
    ok: true,
    changed: responses.some((response) => response.changed),
    isValidJson: responses.every((response) => response.isValidJson !== false)
  }
}
