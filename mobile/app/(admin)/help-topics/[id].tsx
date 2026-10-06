import { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { C } from "@/constants/theme";
import api from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import { queryKeys } from "@/lib/queryKeys";
import type { components } from "@/lib/apiSchema";

type AdminHelpTopic = components["schemas"]["AdminHelpTopic"];
type Input = components["schemas"]["HelpTopicInput"];
type Locale = components["schemas"]["Locale"];
type Translations = components["schemas"]["Translations"];

const LOCALES: { id: Locale; label: string }[] = [
  { id: "en", label: "English" }, { id: "fr", label: "Français" }, { id: "rw", label: "Kinyarwanda" }, { id: "sw", label: "Kiswahili" },
];
const SERVICES = ["rides", "hire", "rental", "shared", "bus"] as const;
const CONTEXTS = ["charged_wrong", "driver_behaviour", "lost_item", "safety", "cancel", "damage", "payment", "account", "other"] as const;
const empty: Translations = { en: "", fr: "", rw: "", sw: "" };

type Form = { slug: string; title: Translations; body: Translations; services: string[]; contexts: string[]; sort: string; published: boolean };

const toForm = (t?: AdminHelpTopic): Form => ({
  slug: t?.slug ?? "", title: t?.title ?? { ...empty }, body: t?.body ?? { ...empty },
  services: t?.services ?? [], contexts: t?.contexts ?? [], sort: String(t?.sort ?? 100), published: t?.published ?? true,
});

/** Admin: write a help topic in all 4 languages (S16.2) */
export default function AdminHelpTopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(isNew ? toForm() : null);
  const [lang, setLang] = useState<Locale>("en");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: queryKeys.admin.helpTopics(),
    queryFn: () => api.get<{ data: AdminHelpTopic[] }>("/admin/help-topics").then(r => r.data.data),
    enabled: !isNew,
  });
  useEffect(() => {
    const topic = list.data?.find(t => t.id === Number(id));
    if (topic && !form) setForm(toForm(topic));
  }, [list.data, id, form]);

  const done = () => { queryClient.invalidateQueries({ queryKey: queryKeys.admin.helpTopics() }); router.back(); };
  const onError = (err: any) => {
    const e = err?.response?.data?.errors;
    if (e) {
      const first: Record<string, string> = {};
      for (const [k, v] of Object.entries(e)) first[k] = Array.isArray(v) ? String(v[0]) : String(v);
      setErrors(first);
      Alert.alert("Check the topic", Object.entries(first).map(([k, v]) => `${k}: ${v}`)[0]);
    } else Alert.alert("Error", "Could not save.");
  };
  const save = useMutation({
    mutationFn: (f: Form) => {
      const payload: Input = { slug: f.slug.trim(), title: f.title, body: f.body, services: f.services as Input["services"],
        contexts: f.contexts as Input["contexts"], sort: Number(f.sort) || 100, published: f.published };
      return isNew ? api.post("/admin/help-topics", payload) : api.put(`/admin/help-topics/${id}`, payload);
    },
    onSuccess: done,
    onError,
  });
  const remove = useMutation({ mutationFn: () => api.delete(`/admin/help-topics/${id}`), onSuccess: done, onError });

  if (!form) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title="Help topic" showBack />
      <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
    </SafeAreaView>
  );

  const set = (patch: Partial<Form>) => setForm(f => f && ({ ...f, ...patch }));
  const toggle = (key: "services" | "contexts", value: string) =>
    set({ [key]: form[key].includes(value) ? form[key].filter(v => v !== value) : [...form[key], value] } as Partial<Form>);
  const missing = (l: Locale) => !form.title[l].trim() || !form.body[l].trim();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AdminHeader title={isNew ? "New help topic" : form.title.en || "Help topic"} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Box>
          <Label text={errors.slug ?? "Short link (a-z, 0-9, -)"} error={!!errors.slug} />
          <Input value={form.slug} onChange={v => set({ slug: v.toLowerCase() })} placeholder="lost-item" />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <Text style={{ color: C.dark, fontWeight: "700" }}>Published</Text>
            <Switch value={form.published} onValueChange={v => set({ published: v })} accessibilityLabel="Published" />
          </View>
        </Box>
        <Box>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
            {LOCALES.map(l => (
              <TouchableOpacity key={l.id} onPress={() => setLang(l.id)} accessibilityLabel={l.label}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: lang === l.id ? C.teal : C.bg }}>
                <Text style={{ color: lang === l.id ? C.white : missing(l.id) ? C.orange : C.mid, fontWeight: "800" }}>{l.id.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Label text={errors[`title.${lang}`] ?? "Title"} error={!!errors[`title.${lang}`]} />
          <Input value={form.title[lang]} onChange={v => set({ title: { ...form.title, [lang]: v } })} />
          <Label text={errors[`body.${lang}`] ?? "Answer (blank line = new paragraph)"} error={!!errors[`body.${lang}`]} />
          <Input value={form.body[lang]} onChange={v => set({ body: { ...form.body, [lang]: v } })} multiline />
          <Text style={{ color: C.muted, fontSize: 11 }}>All 4 languages are required. Orange = still empty.</Text>
        </Box>
        <Box>
          <Label text="Services (none = every service)" />
          <Chips options={SERVICES} on={form.services} onToggle={v => toggle("services", v)} />
          <Label text="Shown for these trip problems" />
          <Chips options={CONTEXTS} on={form.contexts} onToggle={v => toggle("contexts", v)} />
          <Label text="Order (lower first)" />
          <Input value={form.sort} onChange={v => set({ sort: v })} numeric />
        </Box>
        <TouchableOpacity onPress={() => save.mutate(form)} disabled={save.isPending} accessibilityLabel="Save help topic"
          style={{ backgroundColor: C.teal, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
          {save.isPending ? <ActivityIndicator color={C.white} /> : <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>Save</Text>}
        </TouchableOpacity>
        {!isNew && (
          <TouchableOpacity accessibilityLabel="Delete help topic" style={{ alignItems: "center", paddingVertical: 10 }}
            onPress={() => Alert.alert("Delete", "Delete this topic?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate() }])}>
            <Text style={{ color: C.orange, fontWeight: "800" }}>Delete</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14 }}>{children}</View>;
}
function Label({ text, error }: { text: string; error?: boolean }) {
  return <Text style={{ color: error ? C.orange : C.mid, fontSize: 11, fontWeight: "700", marginTop: 8, marginBottom: 4 }}>{text}</Text>;
}
function Input({ value, onChange, multiline, numeric, placeholder }: { value: string; onChange: (v: string) => void; multiline?: boolean; numeric?: boolean; placeholder?: string }) {
  return (
    <TextInput value={value} onChangeText={onChange} multiline={multiline} placeholder={placeholder} placeholderTextColor={C.muted}
      keyboardType={numeric ? "number-pad" : "default"} autoCapitalize={multiline ? "sentences" : "none"}
      style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, color: C.dark, backgroundColor: C.bg,
        minHeight: multiline ? 160 : undefined, textAlignVertical: multiline ? "top" : "center" }} />
  );
}
function Chips({ options, on, onToggle }: { options: readonly string[]; on: string[]; onToggle: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const active = on.includes(o);
        return (
          <TouchableOpacity key={o} onPress={() => onToggle(o)} accessibilityLabel={o}
            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: active ? C.teal : C.bg }}>
            <Text style={{ color: active ? C.white : C.mid, fontWeight: "700", fontSize: 12 }}>{o.replace(/_/g, " ")}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
