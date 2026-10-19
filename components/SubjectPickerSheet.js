"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { canCommitSubjects, MAX_SUBJECTS, MIN_SUBJECTS, normalizeSubjects, SUBJECTS } from "@/lib/subjects"

export default function SubjectPickerSheet({ onConfirm }) {
  const [selected, setSelected] = useState([])
  const [custom, setCustom] = useState("")
  const customLabel = custom.trim()
  const atLimit = selected.length >= MAX_SUBJECTS

  function toggle(label) {
    setSelected((current) => {
      if (current.includes(label)) return current.filter((item) => item !== label)
      if (current.length >= MAX_SUBJECTS) return current
      return [...current, label]
    })
  }

  function addCustom() {
    if (!customLabel) return
    setSelected((current) => {
      if (current.includes(customLabel) || current.length >= MAX_SUBJECTS) return current
      return [...current, customLabel]
    })
    setCustom("")
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink-900/35">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subject-picker-title"
        className="max-h-[72%] overflow-y-auto overscroll-contain rounded-t-2xl bg-white px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(28,24,20,0.18)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-200" aria-hidden />
        <h3 id="subject-picker-title" className="text-sm font-semibold text-ink-900">
          바꿀 사물·영역을 고르세요
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-stone-500">
          최대 {MAX_SUBJECTS}개까지 선택할 수 있습니다. 칩을 누르거나 직접 입력하세요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUBJECTS.map((item) => {
            const on = selected.includes(item.label)
            const locked = !on && atLimit
            return (
              <button
                key={item.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={locked}
                onClick={() => toggle(item.label)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
                  on
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-stone-200 bg-ink-50 text-ink-800 enabled:active:bg-ink-100 disabled:opacity-40"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    on ? "border-white bg-white text-ink-900" : "border-stone-300 bg-white"
                  }`}
                  aria-hidden
                >
                  {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                {item.label}
              </button>
            )
          })}
        </div>
        {selected.length ? (
          <p className="mt-2 text-[11px] text-stone-500">
            선택 {selected.length}/{MAX_SUBJECTS} · {selected.join(", ")}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">직접 입력</span>
            <input
              type="text"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  addCustom()
                }
              }}
              placeholder="직접 입력 (예: 협탁)"
              disabled={atLimit}
              className="min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm text-ink-900 outline-none placeholder:text-stone-400 focus:border-ink-800 disabled:bg-stone-100 disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={addCustom}
            disabled={!customLabel || atLimit || selected.includes(customLabel)}
            className="min-h-11 shrink-0 rounded-xl border border-stone-300 px-3 text-sm font-medium text-ink-800 enabled:active:bg-ink-50 disabled:opacity-40"
          >
            추가
          </button>
        </div>
        <button
          type="button"
          disabled={!canCommitSubjects(selected)}
          onClick={() => {
            const saved = normalizeSubjects(selected)
            if (!canCommitSubjects(saved)) return
            onConfirm(saved)
          }}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-ink-900 text-sm font-medium text-white disabled:opacity-40"
        >
          {canCommitSubjects(selected)
            ? `선택 완료 (${selected.length}/${MAX_SUBJECTS})`
            : `최소 ${MIN_SUBJECTS}개 이상 선택하세요`}
        </button>
      </div>
    </div>
  )
}
