'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, getErrorMessage, hydrateSession } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import { useSession } from '@/lib/use-session'
import type { MemberView, NutritionPlanView, RoutineExercise, RoutineView } from '@/types'
import { EmptyState } from '@/ui/layout/EmptyState'
import { PageHeader } from '@/ui/layout/PageHeader'
import { Button } from '@/ui/primitives/Button'
import { NumericInput } from '@/ui/primitives/NumericInput'

interface ExerciseDraft {
  id: string
  name: string
  sets: number
  reps: number
  weightKg: number
}

function emptyExercise(): ExerciseDraft {
  return {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `ex-${Date.now()}`,
    name: '',
    sets: 3,
    reps: 10,
    weightKg: 0,
  }
}

export function RoutineBuilder() {
  const session = useSession()
  const [hydrated, setHydrated] = useState(false)
  const [members, setMembers] = useState<MemberView[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [memberId, setMemberId] = useState('')
  const [routineName, setRoutineName] = useState('')
  const [exercises, setExercises] = useState<ExerciseDraft[]>([emptyExercise()])
  const [calories, setCalories] = useState(2000)
  const [proteinG, setProteinG] = useState(150)
  const [carbsG, setCarbsG] = useState(200)
  const [fatG, setFatG] = useState(60)
  const [routines, setRoutines] = useState<RoutineView[]>([])
  const [nutrition, setNutrition] = useState<NutritionPlanView[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    hydrateSession()
    setHydrated(true)
  }, [])

  const allowed = session?.principal.role === 'OWNER' || session?.principal.role === 'MANAGER'

  const load = useCallback(async () => {
    setLoading(true)
    const [memberResult, routineResult, nutritionResult] = await Promise.allSettled([
      api.members.list({ pageSize: 200 }),
      api.routines.list({ pageSize: 10 }),
      api.nutrition.list({ pageSize: 10 }),
    ])
    if (memberResult.status === 'fulfilled') setMembers(memberResult.value.items)
    if (routineResult.status === 'fulfilled') setRoutines(routineResult.value.items)
    if (nutritionResult.status === 'fulfilled') setNutrition(nutritionResult.value.items)
    const failures = [memberResult, routineResult, nutritionResult].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    if (failures.length > 0) setError(getErrorMessage(failures[0]?.reason))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (allowed) void load()
  }, [allowed, load])

  const filteredMembers = members
    .filter((member) => {
      const needle = memberQuery.trim().toLowerCase()
      return (
        !needle ||
        member.fullName.toLowerCase().includes(needle) ||
        member.document.toLowerCase().includes(needle)
      )
    })
    .slice(0, 8)

  function updateExercise(id: string, patch: Partial<ExerciseDraft>) {
    setExercises((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  async function handleSave() {
    if (saving) return
    const validExercises = exercises.filter((exercise) => exercise.name.trim().length > 0)
    if (!memberId || !routineName.trim() || validExercises.length === 0) {
      setError('Selecciona un socio, nombra la rutina y captura al menos un ejercicio.')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)

    const payloadExercises: RoutineExercise[] = validExercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name.trim(),
      sets: Math.round(exercise.sets),
      reps: Math.round(exercise.reps),
      weightKg: exercise.weightKg,
    }))
    const routinePromise = api.routines.create({
      memberId,
      name: routineName.trim(),
      exercises: payloadExercises,
    })
    const nutritionPromise = api.nutrition.create({
      memberId,
      name: `Macros · ${routineName.trim()}`,
      calories: Math.round(calories),
      proteinG: Math.round(proteinG),
      carbsG: Math.round(carbsG),
      fatG: Math.round(fatG),
    })

    const [routineResult, nutritionResult] = await Promise.allSettled([routinePromise, nutritionPromise])
    if (routineResult.status === 'fulfilled') {
      setRoutines((current) => [routineResult.value, ...current])
      setRoutineName('')
      setExercises([emptyExercise()])
    }
    if (nutritionResult.status === 'fulfilled') setNutrition((current) => [nutritionResult.value, ...current])
    const failures = [routineResult, nutritionResult].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    if (failures.length > 0) {
      const messages = failures.map((failure) => getErrorMessage(failure.reason))
      if (routineResult.status === 'fulfilled' && failures.length === 1) {
        setNotice(`Rutina asignada. El plan nutricional no se guardó: ${messages[0] ?? 'error desconocido'}`)
      } else {
        setError(messages[0] ?? 'No se pudo guardar la asignación.')
      }
    } else {
      setNotice('Rutina y plan nutricional asignados correctamente.')
    }
    setSaving(false)
  }

  if (!hydrated || !session) {
    return (
      <>
        <PageHeader
          eyebrow="Entrenamiento y nutrición"
          title="Asignación de rutinas"
          description="Verificando tu perfil para mostrar el constructor de rutinas."
        />
        <div className="h-64 animate-pulse border border-hairline bg-surface" />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader
          eyebrow="Entrenamiento y nutrición"
          title="Asignación de rutinas"
          description="El diseño de planes de entrenamiento requiere perfil de encargado o superior."
        />
        <EmptyState
          eyebrow="Acceso restringido"
          title="Requiere perfil de encargado"
          description="Tu perfil puede consultar la operación diaria, pero no asignar rutinas ni planes nutricionales."
        />
      </>
    )
  }

  const selectedMember = members.find((member) => member.id === memberId)

  return (
    <>
      <PageHeader
        eyebrow="Entrenamiento y nutrición"
        title="Asignación de rutinas"
        description="Construye la rutina y los objetivos de macro­nutrientes en una sola operación, vinculados al expediente del socio."
      />

      {notice ? <p role="status" className="mb-6 border-l-2 border-emerald bg-surface px-5 py-3 text-sm">{notice}</p> : null}
      {error ? (
        <div role="alert" className="mb-6 border-l-2 border-ignition bg-surface px-5 py-4 text-sm text-muted">
          {error}
        </div>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-[1.25fr_1fr]">
        <section className="space-y-10">
          <div>
            <h2 className="mb-4 border-b border-hairline pb-4 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
              01 · Seleccionar socio
            </h2>
            <input
              type="search"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="Buscar socio…"
              aria-label="Buscar socio"
              className="h-12 w-full border border-hairline bg-surface px-4 text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/60 focus:border-volt"
            />
            <div className="mt-2 max-h-56 overflow-y-auto border border-hairline">
              {loading ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Cargando socios…</p>
              ) : filteredMembers.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Sin resultados.</p>
              ) : (
                filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setMemberId(member.id)
                      setMemberQuery(member.fullName)
                    }}
                    className={[
                      'flex min-h-12 w-full items-center justify-between border-b border-hairline px-4 text-left text-sm transition-colors duration-300 ease-kinetic',
                      memberId === member.id ? 'bg-[var(--color-surface-raised)] text-volt' : 'text-ink hover:bg-surface',
                    ].join(' ')}
                  >
                    <span className="font-semibold">{member.fullName}</span>
                    <span className="tabular text-xs text-muted">{member.document}</span>
                  </button>
                ))
              )}
            </div>
            {selectedMember ? (
              <p className="mt-3 text-xs text-muted">
                Asignando a <span className="font-semibold text-ink">{selectedMember.fullName}</span>
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="mb-4 border-b border-hairline pb-4 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
              02 · Ejercicios
            </h2>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Nombre de la rutina</span>
              <input
                value={routineName}
                onChange={(event) => setRoutineName(event.target.value)}
                placeholder="Fuerza · tren superior"
                className="h-12 w-full border border-hairline bg-surface px-4 text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/50 focus:border-volt"
              />
            </label>

            <div className="mt-6 space-y-5">
              {exercises.map((exercise, index) => (
                <div key={exercise.id} className="border border-hairline bg-surface p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-volt">
                      Ejercicio {String(index + 1).padStart(2, '0')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setExercises((current) => current.filter((item) => item.id !== exercise.id))}
                      disabled={exercises.length === 1}
                      className="min-h-12 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted transition-colors duration-300 ease-kinetic hover:text-ignition disabled:opacity-30"
                    >
                      Quitar
                    </button>
                  </div>
                  <input
                    value={exercise.name}
                    onChange={(event) => updateExercise(exercise.id, { name: event.target.value })}
                    placeholder="Press banca"
                    aria-label={`Nombre del ejercicio ${index + 1}`}
                    className="h-12 w-full border border-hairline bg-canvas px-4 text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/50 focus:border-volt"
                  />
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <NumericInput
                      label="Series"
                      value={exercise.sets}
                      onChange={(value) => updateExercise(exercise.id, { sets: value })}
                      min={1}
                      max={20}
                    />
                    <NumericInput
                      label="Repeticiones"
                      value={exercise.reps}
                      onChange={(value) => updateExercise(exercise.id, { reps: value })}
                      min={1}
                      max={100}
                    />
                    <NumericInput
                      label="Peso"
                      value={exercise.weightKg}
                      onChange={(value) => updateExercise(exercise.id, { weightKg: value })}
                      min={0}
                      step={2.5}
                      suffix="kg"
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="mt-5" onClick={() => setExercises((current) => [...current, emptyExercise()])}>
              Agregar ejercicio
            </Button>
          </div>
        </section>

        <section className="space-y-10">
          <div>
            <h2 className="mb-4 border-b border-hairline pb-4 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
              03 · Objetivos nutricionales
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <NumericInput label="Calorías" value={calories} onChange={setCalories} min={0} step={50} suffix="kcal" />
              <NumericInput label="Proteína" value={proteinG} onChange={setProteinG} min={0} step={5} suffix="g" />
              <NumericInput label="Carbohidratos" value={carbsG} onChange={setCarbsG} min={0} step={5} suffix="g" />
              <NumericInput label="Grasas" value={fatG} onChange={setFatG} min={0} step={5} suffix="g" />
            </div>
            <div className="mt-8 border-t border-hairline pt-6">
              <Button fullWidth loading={saving} onClick={() => void handleSave()}>
                {saving ? 'Guardando asignación' : 'Asignar a socio'}
              </Button>
              <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
                Rutina y macronutrientes se guardan en el expediente del socio y quedan disponibles en su app.
              </p>
            </div>
          </div>

          <div>
            <h2 className="mb-4 border-b border-hairline pb-4 font-display text-base font-extrabold uppercase tracking-[-0.03em]">
              Asignaciones recientes
            </h2>
            {routines.length === 0 && nutrition.length === 0 ? (
              <EmptyState
                eyebrow="Sin asignaciones"
                title="Todo por construir"
                description="Las rutinas y planes nutricionales asignados aparecerán en este resumen."
              />
            ) : (
              <ul>
                {routines.slice(0, 5).map((routine) => (
                  <li key={routine.id} className="border-b border-hairline py-4">
                    <p className="text-sm font-semibold text-ink">{routine.name}</p>
                    <p className="tabular mt-1 text-[11px] uppercase tracking-[0.1em] text-muted">
                      {routine.memberName} · {routine.exercises.length} ejercicios · {formatDate(routine.createdAt)}
                    </p>
                  </li>
                ))}
                {nutrition.slice(0, 5).map((plan) => (
                  <li key={`nut-${plan.id}`} className="border-b border-hairline py-4">
                    <p className="text-sm font-semibold text-ink">{plan.name}</p>
                    <p className="tabular mt-1 text-[11px] uppercase tracking-[0.1em] text-muted">
                      {plan.calories} kcal · P {plan.proteinG}g · C {plan.carbsG}g · G {plan.fatG}g
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
