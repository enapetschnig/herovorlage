import { router } from "./trpc";
import { tenantRouter } from "./routers/tenant";
import { contactsRouter } from "./routers/contacts";
import { projectsRouter } from "./routers/projects";
import { tasksRouter } from "./routers/tasks";
import { articlesRouter } from "./routers/articles";
import { documentsRouter } from "./routers/documents";
import { timeRouter } from "./routers/time";
import { dashboardRouter } from "./routers/dashboard";
import { logbookRouter } from "./routers/logbook";
import { searchRouter } from "./routers/search";
import { filesRouter } from "./routers/files";
import { maintenanceRouter } from "./routers/maintenance";
import { flowAiRouter } from "./routers/flowai";
import { calculationRouter } from "./routers/calculation";
import { fundingRouter } from "./routers/funding";
import { kanbanRouter } from "./routers/kanban";
import { projectMessagesRouter } from "./routers/projectMessages";
import { remindersRouter } from "./routers/reminders";
import { scheduleRouter } from "./routers/schedule";
import { warehouseRouter } from "./routers/warehouse";
import { checklistsRouter } from "./routers/checklists";
import { heizlastRouter } from "./routers/heizlast";
import { billingRouter } from "./routers/billing";

export const appRouter = router({
  tenant: tenantRouter,
  contacts: contactsRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  articles: articlesRouter,
  documents: documentsRouter,
  time: timeRouter,
  dashboard: dashboardRouter,
  logbook: logbookRouter,
  search: searchRouter,
  files: filesRouter,
  maintenance: maintenanceRouter,
  flowai: flowAiRouter,
  calculation: calculationRouter,
  funding: fundingRouter,
  kanban: kanbanRouter,
  projectMessages: projectMessagesRouter,
  reminders: remindersRouter,
  schedule: scheduleRouter,
  warehouse: warehouseRouter,
  checklists: checklistsRouter,
  heizlast: heizlastRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
