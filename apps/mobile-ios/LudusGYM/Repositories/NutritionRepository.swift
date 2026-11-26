import Foundation

struct NutritionRepository {
    private let api = APIClient.shared
    private let store = FileStore.shared

    func plan() async -> NutritionPlan {
        if let dtos: [NutritionPlanDTO] = try? await api.request("api/nutrition-plans"),
           let first = dtos.first, !(first.meals ?? []).isEmpty {
            let plan = NutritionPlan(dto: first)
            await store.save(plan, key: "nutrition_plan")
            return plan
        }
        if let cached: NutritionPlan = await store.load("nutrition_plan") {
            return cached
        }
        return .demo
    }
}

extension NutritionPlan {
    /// Plan de reserva cuando la API no devuelve datos (mismo criterio que DemoCatalog).
    static var demo: NutritionPlan {
        NutritionPlan(
            id: "nutrition-demo",
            title: "Plan rendimiento · Día de entrenamiento",
            calories: 2450,
            proteinG: 190,
            carbsG: 265,
            fatG: 72,
            hydrationMl: 2800,
            meals: [
                Meal(id: "meal-1", name: "Desayuno", time: "breakfast", calories: 520, proteinG: 35, carbsG: 62, fatG: 16, foods: ["Avena", "Huevo", "Plátano"]),
                Meal(id: "meal-2", name: "Comida", time: "lunch", calories: 780, proteinG: 55, carbsG: 85, fatG: 22, foods: ["Pollo", "Arroz", "Aguacate"]),
                Meal(id: "meal-3", name: "Snack", time: "snack", calories: 320, proteinG: 28, carbsG: 30, fatG: 10, foods: ["Yogur griego", "Frutos secos"]),
                Meal(id: "meal-4", name: "Cena", time: "dinner", calories: 610, proteinG: 48, carbsG: 55, fatG: 18, foods: ["Salmón", "Papa", "Espinaca"]),
                Meal(id: "meal-5", name: "Extra", time: "snack", calories: 220, proteinG: 24, carbsG: 33, fatG: 6, foods: ["Proteína", "Manzana"])
            ]
        )
    }
}
