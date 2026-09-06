"use client";

import { DealStageType } from "@prisma/client";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClientStageMessagesEditor } from "@/components/settings/client-stage-messages-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { api } from "@/lib/api-client";
import { getDefaultCompanyWorkspace } from "@/lib/company-workspace/defaults";
import type {
  CompanyDocumentType,
  CustomDealField,
  ResolvedCompanyWorkspace,
} from "@/lib/company-workspace/types";
import { STAGE_ORDER } from "@/lib/constants";

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-input accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function CompanyWorkspacePanel() {
  const { applyLocal } = useCompanyWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ResolvedCompanyWorkspace>(getDefaultCompanyWorkspace);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.companyWorkspace.get();
      applyLocal(data);
      setForm({
        stageLabels: data.stageLabels,
        clientVisibleStages: data.clientVisibleStages,
        dealTabs: data.dealTabs,
        dealFields: data.dealFields,
        customDealFields: data.customDealFields,
        documentTypes: data.documentTypes,
        additionalOptionGroups: data.additionalOptionGroups,
        modules: data.modules,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить настройки компании");
    } finally {
      setLoading(false);
    }
  }, [applyLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await api.companyWorkspace.save(form);
      applyLocal(saved);
      setForm({
        stageLabels: saved.stageLabels,
        clientVisibleStages: saved.clientVisibleStages,
        dealTabs: saved.dealTabs,
        dealFields: saved.dealFields,
        customDealFields: saved.customDealFields,
        documentTypes: saved.documentTypes,
        additionalOptionGroups: saved.additionalOptionGroups,
        modules: saved.modules,
      });
      toast.success("Настройки компании сохранены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  const toggleClientStage = (stage: DealStageType, visible: boolean) => {
    setForm((current) => {
      const next = new Set(current.clientVisibleStages);
      if (visible) next.add(stage);
      else next.delete(stage);
      return { ...current, clientVisibleStages: STAGE_ORDER.filter((item) => next.has(item)) };
    });
  };

  const updateCustomField = (id: string, patch: Partial<CustomDealField>) => {
    setForm((current) => ({
      ...current,
      customDealFields: current.customDealFields.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    }));
  };

  const updateDocumentType = (key: string, patch: Partial<CompanyDocumentType>) => {
    setForm((current) => ({
      ...current,
      documentTypes: current.documentTypes.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    }));
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Модули</CardTitle>
          <CardDescription>
            Скрытые разделы не показываются в меню сотрудникам этой компании.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <CheckRow
            checked={form.modules.catalog}
            onChange={(catalog) => setForm((current) => ({ ...current, modules: { ...current.modules, catalog } }))}
          >
            Каталог
          </CheckRow>
          <CheckRow
            checked={form.modules.calculator}
            onChange={(calculator) =>
              setForm((current) => ({ ...current, modules: { ...current.modules, calculator } }))
            }
          >
            Калькулятор
          </CheckRow>
          <CheckRow
            checked={form.modules.carCarrier}
            onChange={(carCarrier) =>
              setForm((current) => ({ ...current, modules: { ...current.modules, carCarrier } }))
            }
          >
            Карта автовоза
          </CheckRow>
          <CheckRow
            checked={form.modules.googleCalendar}
            onChange={(googleCalendar) =>
              setForm((current) => ({
                ...current,
                modules: { ...current.modules, googleCalendar },
              }))
            }
          >
            Google Календарь
          </CheckRow>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Воронка и названия</CardTitle>
          <CardDescription>
            Семь этапов канбана не меняются. Можно задать свои подписи и выбрать, какие этапы
            видит клиент в прогрессе.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="space-y-1.5">
                <Label htmlFor={`stage-label-${stage}`}>Подпись этапа</Label>
                <Input
                  id={`stage-label-${stage}`}
                  value={form.stageLabels[stage]}
                  maxLength={40}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stageLabels: { ...current.stageLabels, [stage]: event.target.value },
                    }))
                  }
                />
              </div>
              <CheckRow
                checked={form.clientVisibleStages.includes(stage)}
                onChange={(visible) => toggleClientStage(stage, visible)}
              >
                Показывать клиенту
              </CheckRow>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Вкладки карточки</CardTitle>
          <CardDescription>
            Что включено в карточке сделки. «Доставка» также задаёт значение по умолчанию для
            новых сделок.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <CheckRow
            checked={form.dealTabs.searchProcess}
            onChange={(searchProcess) =>
              setForm((current) => ({ ...current, dealTabs: { ...current.dealTabs, searchProcess } }))
            }
          >
            Поиск авто
          </CheckRow>
          <CheckRow
            checked={form.dealTabs.importProcess}
            onChange={(importProcess) =>
              setForm((current) => ({ ...current, dealTabs: { ...current.dealTabs, importProcess } }))
            }
          >
            Доставка
          </CheckRow>
          <CheckRow
            checked={form.dealTabs.logistics}
            onChange={(logistics) =>
              setForm((current) => ({ ...current, dealTabs: { ...current.dealTabs, logistics } }))
            }
          >
            Логистика
          </CheckRow>
          <CheckRow
            checked={form.dealTabs.additionalOptions}
            onChange={(additionalOptions) =>
              setForm((current) => ({
                ...current,
                dealTabs: { ...current.dealTabs, additionalOptions },
              }))
            }
          >
            Доп. опции
          </CheckRow>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Поля карточки клиента</CardTitle>
          <CardDescription>
            VIN, год и город экспорта можно скрыть или сделать обязательными. Свои поля появятся
            в форме создания и в карточке.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["vin", "VIN"],
              ["carYear", "Год"],
              ["destinationCity", "Город экспорта"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
              <p className="min-w-[8rem] text-sm font-medium">{label}</p>
              <CheckRow
                checked={form.dealFields[key].enabled}
                onChange={(enabled) =>
                  setForm((current) => ({
                    ...current,
                    dealFields: {
                      ...current.dealFields,
                      [key]: {
                        enabled,
                        required: enabled ? current.dealFields[key].required : false,
                      },
                    },
                  }))
                }
              >
                Показывать
              </CheckRow>
              <CheckRow
                checked={form.dealFields[key].required}
                onChange={(required) =>
                  setForm((current) => ({
                    ...current,
                    dealFields: {
                      ...current.dealFields,
                      [key]: { ...current.dealFields[key], required: current.dealFields[key].enabled && required },
                    },
                  }))
                }
              >
                Обязательное
              </CheckRow>
            </div>
          ))}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Дополнительные поля</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    customDealFields: [
                      ...current.customDealFields,
                      { id: newId("field"), label: "Новое поле", required: false, enabled: true },
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Поле
              </Button>
            </div>
            {form.customDealFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Например: бюджет, источник лида, комплектация.
              </p>
            ) : (
              form.customDealFields.map((field) => (
                <div key={field.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                  <Input
                    value={field.label}
                    onChange={(event) => updateCustomField(field.id, { label: event.target.value })}
                    placeholder="Название поля"
                  />
                  <CheckRow
                    checked={field.enabled}
                    onChange={(enabled) => updateCustomField(field.id, { enabled })}
                  >
                    Показывать
                  </CheckRow>
                  <CheckRow
                    checked={field.required}
                    onChange={(required) => updateCustomField(field.id, { required })}
                  >
                    Обязательное
                  </CheckRow>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        customDealFields: current.customDealFields.filter((item) => item.id !== field.id),
                      }))
                    }
                    aria-label="Удалить поле"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Типы документов</CardTitle>
          <CardDescription>
            Свой набор вместо общего списка. Отключённые типы не создаются в новых сделках.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["main", "received"] as const).map((group) => (
            <div key={group} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {group === "main" ? "Основные документы" : "Полученные документы"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      documentTypes: [
                        ...current.documentTypes,
                        {
                          key: `CUSTOM_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
                          label: "Новый документ",
                          enabled: true,
                          group,
                          builtin: false,
                        },
                      ],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Тип
                </Button>
              </div>
              {form.documentTypes
                .filter((item) => item.group === group)
                .map((item) => (
                  <div key={item.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <Input
                      value={item.label}
                      onChange={(event) => updateDocumentType(item.key, { label: event.target.value })}
                    />
                    <CheckRow
                      checked={item.enabled}
                      onChange={(enabled) => updateDocumentType(item.key, { enabled })}
                    >
                      Включён
                    </CheckRow>
                    {!item.builtin ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            documentTypes: current.documentTypes.filter((doc) => doc.key !== item.key),
                          }))
                        }
                        aria-label="Удалить тип"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">системный</span>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Дополнительные опции</CardTitle>
          <CardDescription>
            Группы и позиции каталога компании. В сделке по-прежнему можно добавить разовую свою
            опцию.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  additionalOptionGroups: [
                    ...current.additionalOptionGroups,
                    { id: newId("group"), title: "Новая группа", options: [] },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Группа
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  additionalOptionGroups: getDefaultCompanyWorkspace().additionalOptionGroups,
                }))
              }
            >
              Сбросить к стандартным
            </Button>
          </div>

          {form.additionalOptionGroups.map((group, groupIndex) => (
            <div key={group.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={group.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      additionalOptionGroups: current.additionalOptionGroups.map((item, index) =>
                        index === groupIndex ? { ...item, title: event.target.value } : item,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      additionalOptionGroups: current.additionalOptionGroups.filter(
                        (_, index) => index !== groupIndex,
                      ),
                    }))
                  }
                  aria-label="Удалить группу"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {group.options.map((option, optionIndex) => (
                <div key={option.key} className="flex items-center gap-2 pl-2">
                  <Input
                    value={option.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        additionalOptionGroups: current.additionalOptionGroups.map((item, index) =>
                          index === groupIndex
                            ? {
                                ...item,
                                options: item.options.map((opt, optIndex) =>
                                  optIndex === optionIndex ? { ...opt, label: event.target.value } : opt,
                                ),
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        additionalOptionGroups: current.additionalOptionGroups.map((item, index) =>
                          index === groupIndex
                            ? {
                                ...item,
                                options: item.options.filter((_, optIndex) => optIndex !== optionIndex),
                              }
                            : item,
                        ),
                      }))
                    }
                    aria-label="Удалить опцию"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    additionalOptionGroups: current.additionalOptionGroups.map((item, index) =>
                      index === groupIndex
                        ? {
                            ...item,
                            options: [
                              ...item.options,
                              { key: newId("opt"), label: "Новая опция" },
                            ],
                          }
                        : item,
                    ),
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Опция
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Тексты клиенту по этапам</CardTitle>
          <CardDescription>
            Те же формулировки, что в кабинете, письме и Telegram. Их также можно править во
            вкладке Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientStageMessagesEditor />
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <Button type="button" variant="brand" onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить настройки компании
        </Button>
      </div>
    </div>
  );
}
