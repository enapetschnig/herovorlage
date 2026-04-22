import { ulid } from "ulid";

export function newId(prefix?: string): string {
  const id = ulid();
  return prefix ? `${prefix}_${id}` : id;
}

export const idFor = {
  tenant: () => newId("ten"),
  user: () => newId("usr"),
  contact: () => newId("ctc"),
  contactAddress: () => newId("cad"),
  contactPerson: () => newId("cpe"),
  project: () => newId("prj"),
  projectType: () => newId("pty"),
  projectStage: () => newId("pst"),
  document: () => newId("doc"),
  documentPosition: () => newId("dpo"),
  article: () => newId("art"),
  articleGroup: () => newId("agr"),
  service: () => newId("svc"),
  timeEntry: () => newId("tim"),
  task: () => newId("tsk"),
  file: () => newId("fil"),
  folder: () => newId("fld"),
  logbookEntry: () => newId("log"),
  tag: () => newId("tag"),
  asset: () => newId("ast"),
  maintenanceContract: () => newId("mnt"),
  maintenanceVisit: () => newId("mvi"),
  fundingApplication: () => newId("fun"),
  projectMessage: () => newId("pmsg"),
  emailOutbox: () => newId("eml"),
  reminder: () => newId("rem"),
};
