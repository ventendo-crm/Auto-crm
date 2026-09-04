import { Header } from "@/components/layout/header";
import { KanbanBoard } from "@/components/kanban/kanban-board";

export default function KanbanPage() {
  return (
    <>
      <Header title="Клиенты" subtitle="Управление этапами сделок" />
      <KanbanBoard />
    </>
  );
}
