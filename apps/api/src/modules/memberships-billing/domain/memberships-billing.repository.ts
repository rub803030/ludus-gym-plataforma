// Contrato del repositorio. Implementación en la Fase 2.
export interface Repository<T> {
  findById(id: string): Promise<T | null>
  save(entity: T): Promise<T>
}
