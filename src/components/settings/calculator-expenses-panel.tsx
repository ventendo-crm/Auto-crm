"use client";

import { CalculatorExpenseEditor } from "@/components/calculator/calculator-expense-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CalculatorExpensesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Калькулятор · расходы</CardTitle>
        <CardDescription className="mt-1.5">
          Шаблон расходов вашей компании: можно добавлять, удалять и менять названия и суммы по
          умолчанию. Системные роли влияют на расчёт (ВТБ, инвойс Кореи). Обычные доп. расходы просто
          входят в итог.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CalculatorExpenseEditor />
      </CardContent>
    </Card>
  );
}
