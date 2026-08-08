"use client";

import { CalculatorExpenseEditor } from "@/components/calculator/calculator-expense-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CalculatorExpensesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Калькулятор · расходы</CardTitle>
        <CardDescription className="mt-1.5">
          Выберите страну и настройте каждое поле только для неё: название, сумму, валюту и роль.
          Остальные страны не меняются. Системные роли влияют на расчёт (ВТБ, инвойс Кореи); доп.
          расходы просто входят в итог.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CalculatorExpenseEditor />
      </CardContent>
    </Card>
  );
}
