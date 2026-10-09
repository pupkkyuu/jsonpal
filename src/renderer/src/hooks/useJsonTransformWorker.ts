import { useCallback, useEffect, useRef } from 'react'
import type { JsonTransformAction, JsonTransformRequest, JsonTransformResponse } from '@/jsonTransformTypes'

export function useJsonTransformWorker(): (action: JsonTransformAction, text: string) => Promise<JsonTransformResponse> {
  const workerRef = useRef<Worker | null>(null)
  const nextRequestIdRef = useRef(0)
  const pendingRef = useRef(new Map<number, { resolve: (response: JsonTransformResponse) => void; reject: (error: Error) => void }>())

  useEffect(() => {
    const worker = new Worker(new URL('../jsonTransform.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = ({ data }: MessageEvent<JsonTransformResponse>): void => {
      const pending = pendingRef.current.get(data.id)
      if (!pending) return
      pendingRef.current.delete(data.id)
      pending.resolve(data)
    }
    worker.onerror = (): void => {
      worker.terminate()
      workerRef.current = null
      const error = new Error('JSON 处理器不可用')
      pendingRef.current.forEach(({ reject }) => reject(error))
      pendingRef.current.clear()
    }

    return () => {
      workerRef.current = null
      worker.terminate()
      const error = new Error('JSON 处理器已关闭')
      pendingRef.current.forEach(({ reject }) => reject(error))
      pendingRef.current.clear()
    }
  }, [])

  return useCallback((action: JsonTransformAction, text: string) => {
    const worker = workerRef.current
    if (!worker) return Promise.reject(new Error('JSON 处理器尚未就绪'))

    const id = ++nextRequestIdRef.current
    const request: JsonTransformRequest = { id, action, text }
    return new Promise<JsonTransformResponse>((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject })
      try {
        worker.postMessage(request)
      } catch (error) {
        pendingRef.current.delete(id)
        reject(error instanceof Error ? error : new Error('JSON 处理器不可用'))
      }
    })
  }, [])
}
