import React, { useState, useEffect, useRef, useCallback } from "react";
import { MobileTopBar } from "@/components/MobileNav";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIntegration } from "@/lib/integration";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  Globe,
  Lock,
  Zap,
  Copy,
  Check,
  RotateCcw,
  Wifi,
  Terminal,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Trash2,
  AlertTriangle,
  Plus,
  Sparkles,
  ScanLine,
  Image,
  Trophy,
  HelpCircle,
  Activity,
  Database,
  Link2,
  Gamepad2,
  Keyboard,
  Palette,
  Monitor,
  RefreshCw,
} from "lucide-react";
import type { SmartFilterRules, GameCollectionWithItems } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { THEMES } from "@/lib/themes";
import { BiosManager } from "@/components/BiosManager";

export default function Settings() {
  const { config, setConfig, setEndpoint, resetConfig, saveStatus } = useIntegration();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: t("common.copy"), description: "Endpoint URL is ready to paste." });
  };

  const handleReset = () => {
    if (confirm(t("common.reset") + "?")) {
      resetConfig();
      toast({ title: "Settings reset", description: "Integration defaults restored." });
    }
  };

  const handleLiveModeToggle = (live: boolean) => {
    if (live) {
      toast({
        title: "Live Mode Enabled",
        description: "App will now attempt to call real Home Assistant webhooks.",
      });
    }
    setConfig({ liveMode: live });
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      const res = await fetch(`${config.haBaseUrl}/api/config`, {
        headers: config.haToken ? { Authorization: `Bearer ${config.haToken}` } : undefined
      });
      if (res.ok) {
        toast({ title: "Connection Successful", description: "Cabinet Bridge can reach Home Assistant." });
      } else {
        throw new Error(`${res.status} ${res.statusText}`);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: err instanceof Error ? err.message : "Could not reach Home Assistant base URL."
      });
    } finally {
      setTesting(true);
      setTimeout(() => setTesting(false), 2000);
    }
  };

  return (
    <div className="flex h-full">
      <main className="flex-1 min-w-0 flex flex-col bg-background/30 overflow-y-auto overscroll-y-contain">
        <MobileTopBar />

        <div className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 space-y-8 pb-24 lg:pb-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("settings.header")}
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight mt-1 text-neon">{t("settings.title")}</h1>
            </div>
            <div className="flex items-center gap-3">
              {saveStatus === "saving" && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  <Loader2 className="size-3 animate-spin" /> {t("common.saveStatus.saving")}
                </div>
              )}
              {saveStatus === "saved" && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-accent uppercase tracking-wider">
                  <Check className="size-3" /> {t("common.saveStatus.saved")}
                </div>
              )}
              {saveStatus === "error" && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-destructive uppercase tracking-wider">
                  <ShieldAlert className="size-3" /> {t("common.saveStatus.error")}
                </div>
              )}
            </div>
          </div>

          <Tabs defaultValue="connection" className="w-full">
            <TabsList className="w-full justify-start bg-sidebar/40 border border-border/50 h-auto p-1 mb-8 overflow-x-auto scrollbar-none flex-nowrap shrink-0">
              <TabsTrigger value="connection" className="gap-2 py-2 px-4 rounded-md data-[state=active]:bg-background/80">
                <Globe className="size-4" /> {t("settings.tabs.connection")}
              </TabsTrigger>
              <TabsTrigger value="display" className="gap-2 py-2 px-4 rounded-md data-[state=active]:bg-background/80">
                <Palette className="size-4" /> {t("settings.tabs.display")}
              </TabsTrigger>
              <TabsTrigger value="automation" className="gap-2 py-2 px-4 rounded-md data-[state=active]:bg-background/80">
                <Zap className="size-4" /> {t("settings.tabs.automation")}
              </TabsTrigger>
              <TabsTrigger value="controls" className="gap-2 py-2 px-4 rounded-md data-[state=active]:bg-background/80">
                <Gamepad2 className="size-4" /> {t("settings.tabs.controls")}
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-2 py-2 px-4 rounded-md data-[state=active]:bg-background/80">
                <Database className="size-4" /> {t("settings.tabs.library")}
              </TabsTrigger>
              <TabsTrigger value="health" className="gap-2 py-2 px-4 rounded-md data-[state=active]:bg-background/80">
                <Activity className="size-4" /> {t("settings.tabs.health")}
              </TabsTrigger>
              <TabsTrigger value="services" className="gap-2 py-2 px-4 rounded-md data-[state=active]:bg-background/80">
                <Wifi className="size-4" /> {t("settings.tabs.services")}
              </TabsTrigger>
              <TabsTrigger value="kiosk" className="gap-2 py-2 px-4 rounded-md data-[state=active]:bg-background/80">
                <Lock className="size-4" /> {t("settings.tabs.kiosk")}
              </TabsTrigger>
              <TabsTrigger value="help" className="gap-2 py-2 px-4 rounded-md data-[state=active]:bg-background/80">
                <HelpCircle className="size-4" /> {t("settings.tabs.help")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connection" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Section
                title={t("settings.sections.connection.title")}
                description={t("settings.sections.connection.description")}
              >
                <div className="grid gap-6">
                  <Field label={t("settings.fields.haBaseUrl.label")} hint={t("settings.fields.haBaseUrl.hint")}>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Globe className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={config.haBaseUrl}
                          onChange={(e) => setConfig({ haBaseUrl: e.target.value })}
                          placeholder="https://homeassistant.local:8123"
                          className="pl-9 font-mono text-sm"
                        />
                      </div>
                      <Button
                        variant="secondary"
                        onClick={testConnection}
                        disabled={testing || !config.haBaseUrl}
                        className="gap-2 shrink-0 min-w-[100px]"
                      >
                        {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                        {t("settings.buttons.test")}
                      </Button>
                    </div>
                  </Field>

                  <Field label={t("settings.fields.haToken.label")} hint={t("settings.fields.haToken.hint")}>
                    <div className="relative">
                      <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="password"
                        value={config.haToken}
                        onChange={(e) => setConfig({ haToken: e.target.value })}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="pl-9 font-mono text-sm"
                      />
                    </div>
                  </Field>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border bg-sidebar/40">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 font-display font-semibold text-sm">
                        <Zap className="size-4 text-accent" />
                        {t("settings.fields.liveMode.label")}
                      </div>
                      <div className="text-xs text-muted-foreground max-w-sm">
                        {t("settings.fields.liveMode.hint")}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {config.liveMode ? t("settings.fields.liveMode.active") : t("settings.fields.liveMode.simulation")}
                      </span>
                      <Switch
                        checked={config.liveMode}
                        onCheckedChange={handleLiveModeToggle}
                      />
                    </div>
                  </div>

                  {!config.liveMode && (
                    <div className="flex items-start gap-3 p-4 rounded-lg border border-accent/20 bg-accent/5">
                      <AlertTriangle className="size-4 text-accent mt-0.5 shrink-0" />
                      <div className="text-xs text-accent/90 leading-relaxed">
                        {t("settings.fields.liveMode.notice")}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="display" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <DisplaySettings />
            </TabsContent>

            <TabsContent value="automation" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Section
                title={t("settings.sections.automation.title")}
                description={t("settings.sections.automation.description")}
              >
                <div className="grid sm:grid-cols-2 gap-6">
                  <Field label={t("settings.fields.pcHostname.label")} hint={t("settings.fields.pcHostname.hint")}>
                    <Input
                      value={config.pcHostname}
                      onChange={(e) => setConfig({ pcHostname: e.target.value })}
                      placeholder="GAMING-PC"
                      className="font-mono text-sm"
                    />
                  </Field>
                  <Field label={t("settings.fields.pcOnline.label")} hint={t("settings.fields.pcOnline.hint")}>
                    <Input
                      value={config.pcOnlineEntityId}
                      onChange={(e) => setConfig({ pcOnlineEntityId: e.target.value })}
                      placeholder="binary_sensor.gaming_pc_status"
                      className="font-mono text-sm"
                    />
                  </Field>
                  <Field label={t("settings.fields.pcCpu.label")} hint={t("settings.fields.pcCpu.hint")}>
                    <Input
                      value={config.pcCpuEntityId}
                      onChange={(e) => setConfig({ pcCpuEntityId: e.target.value })}
                      placeholder="sensor.gaming_pc_cpu_usage"
                      className="font-mono text-sm"
                    />
                  </Field>
                  <Field label={t("settings.fields.pcRam.label")} hint={t("settings.fields.pcRam.hint")}>
                    <Input
                      value={config.pcRamEntityId}
                      onChange={(e) => setConfig({ pcRamEntityId: e.target.value })}
                      placeholder="sensor.gaming_pc_ram_usage"
                      className="font-mono text-sm"
                    />
                  </Field>
                  <Field label={t("settings.fields.pcApp.label")} hint={t("settings.fields.pcApp.hint")}>
                    <Input
                      value={config.pcAppEntityId}
                      onChange={(e) => setConfig({ pcAppEntityId: e.target.value })}
                      placeholder="sensor.gaming_pc_current_app"
                      className="font-mono text-sm"
                    />
                  </Field>
                </div>
              </Section>

              <Separator className="bg-border/60" />

              <Section
                title={t("settings.sections.endpoints.title")}
                description={t("settings.sections.endpoints.description")}
              >
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-border bg-sidebar/20">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-neon-cyan">
                      <Wifi className="size-4 text-accent" />
                      System Actions
                    </h3>
                    <div className="grid gap-3">
                      {[
                        { id: "wake_pc", label: "Wake PC", default: "/api/webhook/cabinet_wake_pc" },
                        { id: "sleep_pc", label: "Sleep PC", default: "/api/webhook/cabinet_sleep_pc" },
                        { id: "restart_pc", label: "Restart PC", default: "/api/webhook/cabinet_restart_pc" },
                        { id: "shutdown_pc", label: "Shutdown PC", default: "/api/webhook/cabinet_shutdown_pc" },
                      ].map((a) => (
                        <div key={a.id} className="space-y-1.5">
                          <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                            {a.label}
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              value={config.endpoints[a.id] || a.default}
                              onChange={(e) => setEndpoint(a.id, e.target.value)}
                              className="font-mono text-[12px] bg-background/40"
                            />
                            <Button
                              variant="secondary"
                              size="icon"
                              onClick={() => copy(config.endpoints[a.id] || a.default, a.id)}
                            >
                              {copied === a.id ? (
                                <Check className="size-3.5 text-accent" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-border bg-sidebar/20">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Terminal className="size-4 text-primary" />
                      Sample Game Launch
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Each game has a unique webhook. Example for a specific title:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value="/api/webhook/cabinet_launch_super-mario-world"
                        className="font-mono text-[12px] bg-background/40 opacity-70"
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() =>
                          copy("/api/webhook/cabinet_launch_super-mario-world", "sample-game")
                        }
                      >
                        {copied === "sample-game" ? (
                          <Check className="size-3.5 text-accent" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="controls" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ControlsSettings />
            </TabsContent>

            <TabsContent value="library" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ScannerStatusSection />
              <Separator className="bg-border/60" />
              <SmartFilterCollectionCreator />
            </TabsContent>

            <TabsContent value="health" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <Section
                 title={t("settings.sections.health.title")}
                 description={t("settings.sections.health.description")}
               >
                 <BiosManager />
               </Section>
            </TabsContent>

            <TabsContent value="services" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ServicesSettings />
            </TabsContent>

            <TabsContent value="kiosk" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <KioskSettings />
            </TabsContent>

            <TabsContent value="help" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Section
                title={t("settings.sections.help.title")}
                description={t("settings.sections.help.description")}
              >
                <ul className="space-y-6">
                  <Step n={1} title="Create a Wake-on-LAN Script">
                    Define a script in HA that sends a magic packet to your PC's MAC address.
                    <Code>{`script:
  wake_gaming_pc:
    alias: "Wake Gaming PC"
    sequence:
      - service: wake_on_lan.send_magic_packet
        data:
          mac: "AA:BB:CC:DD:EE:FF"`}</Code>
                  </Step>
                  <Step n={2} title="Setup the Webhook Automation">
                    Create an automation that triggers on the \`cabinet_wake_pc\` webhook and runs your
                    script.
                    <Code>{`automation:
  - alias: "Cabinet: Wake PC"
    trigger:
      - platform: webhook
        webhook_id: cabinet_wake_pc
    action:
      - service: script.wake_gaming_pc`}</Code>
                  </Step>
                  <Step n={3} title="Configure PC Sensors">
                    Install the <strong>HASS.Agent</strong> or <strong>IOT Link</strong> on your Windows
                    PC to provide CPU, RAM, and Online sensors back to Home Assistant.
                  </Step>
                  <Step n={4} title="Enable Live Mode">
                    Go to the <strong>Connection</strong> tab and toggle <strong>Live Mode</strong>. Cabinet Bridge will now send a POST
                    request to your HA webhooks whenever you click an action button.
                  </Step>
                  <Step n={5} title="Add as Sidebar Item (Optional)">
                    Add this to your \`configuration.yaml\` to see Cabinet Bridge in the HA sidebar:
                    <Code>{`panel_iframe:
  cabinet:
    title: "Cabinet"
    icon: mdi:gamepad-variant
    url: "\${window.location.origin}\${window.location.pathname}"`}</Code>
                  </Step>
                </ul>
              </Section>
            </TabsContent>
          </Tabs>

          <Separator className="bg-border/60" />

          {/* Footer actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <ShieldAlert className="size-3.5" />
              {t("settings.autoSaved")}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
            >
              <RotateCcw className="size-3.5" /> {t("settings.buttons.resetDefaults")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function DisplaySettings() {
  const { config, setConfig } = useIntegration();
  const { t } = useTranslation();

  return (
    <div className="space-y-10">
      <Section
        title={t("settings.sections.display.title")}
        description={t("settings.sections.display.description")}
      >
        <div className="grid sm:grid-cols-2 gap-6">
          <Field label={t("settings.fields.language.label")} hint={t("settings.fields.language.hint")}>
            <div className="flex items-center gap-4">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select
                value={config.language ?? "en"}
                onValueChange={(val) => setConfig({ language: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t("languages.en")}</SelectItem>
                  <SelectItem value="es">{t("languages.es")}</SelectItem>
                  <SelectItem value="fr">{t("languages.fr")}</SelectItem>
                  <SelectItem value="de">{t("languages.de")}</SelectItem>
                  <SelectItem value="pt">{t("languages.pt")}</SelectItem>
                  <SelectItem value="ja">{t("languages.ja")}</SelectItem>
                  <SelectItem value="zh">{t("languages.zh")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>

          <Field label={t("settings.fields.systemLabels.label")} hint={t("settings.fields.systemLabels.hint")}>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-sidebar/40 h-10 mt-1">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("settings.fields.systemLabels.show")}</span>
              <Switch
                checked={config.showSystemLabels}
                onCheckedChange={(v) => setConfig({ showSystemLabels: v })}
              />
            </div>
          </Field>

          <Field label={t("settings.fields.uiTheme.label")} hint={t("settings.fields.uiTheme.hint")}>
            <div className="flex items-center gap-4">
              <Palette className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select
                value={config.theme || "default"}
                onValueChange={(val) => setConfig({ theme: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEMES.map((theme) => (
                    <SelectItem key={theme} value={theme}>
                      {theme.charAt(0).toUpperCase() + theme.slice(1).replace("-", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>

          <div />

          <Field label={t("settings.fields.aspectRatio.label")} hint={t("settings.fields.aspectRatio.hint")}>
            <Select
              value={config.globalAspectRatio || "auto"}
              onValueChange={(v) => setConfig({ globalAspectRatio: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("settings.fields.aspectRatio.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("settings.fields.aspectRatio.placeholder")} ({t("common.ui.reset")})</SelectItem>
                <SelectItem value="4/3">4:3</SelectItem>
                <SelectItem value="16/9">16:9</SelectItem>
                <SelectItem value="3/2">3:2</SelectItem>
                <SelectItem value="8/7">8:7</SelectItem>
                <SelectItem value="1/1">1:1</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("settings.fields.shader.label")} hint={t("settings.fields.shader.hint")}>
            <Select
              value={config.globalShader || "none"}
              onValueChange={(v) => setConfig({ globalShader: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("settings.fields.shader.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("settings.fields.shader.placeholder")}</SelectItem>
                <SelectItem value="crt">CRT</SelectItem>
                <SelectItem value="smooth">Smooth</SelectItem>
                <SelectItem value="scanlines">Scanlines</SelectItem>
                <SelectItem value="lcd">LCD</SelectItem>
                <SelectItem value="phosphor">Phosphor</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section
        title={t("settings.sections.overrides.title")}
        description={t("settings.sections.overrides.description")}
      >
        <div className="space-y-3">
          {ALL_SYSTEMS.map((system) => {
            const display = config.systemDisplay?.[system.id] || {};
            const update = (patch: Partial<NonNullable<typeof config.systemDisplay>[string]>) => {
              const next = { ...config.systemDisplay };
              next[system.id] = { ...display, ...patch };
              setConfig({ systemDisplay: next });
            };

            return (
              <div key={system.id} className="p-4 rounded-lg border border-border bg-sidebar/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-display font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                    <Monitor className="size-3.5 text-primary" />
                    {system.label}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] uppercase font-mono text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const next = { ...config.systemDisplay };
                      delete next[system.id];
                      setConfig({ systemDisplay: next });
                    }}
                    disabled={!config.systemDisplay?.[system.id]}
                  >
                    {t("common.ui.reset")}
                  </Button>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-mono text-muted-foreground">{t("settings.fields.aspectRatio.label")}</Label>
                    <Select
                      value={display.aspectRatio || "auto"}
                      onValueChange={(v) => update({ aspectRatio: v === "auto" ? undefined : v })}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background/40">
                        <SelectValue placeholder={t("settings.fields.aspectRatio.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{t("settings.fields.aspectRatio.placeholder")} ({t("common.ui.reset")})</SelectItem>
                        <SelectItem value="4/3">4:3</SelectItem>
                        <SelectItem value="16/9">16:9</SelectItem>
                        <SelectItem value="3/2">3:2</SelectItem>
                        <SelectItem value="8/7">8:7</SelectItem>
                        <SelectItem value="1/1">1:1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-mono text-muted-foreground">{t("settings.fields.shader.label")}</Label>
                    <Select
                      value={display.shader || "none"}
                      onValueChange={(v) => update({ shader: v === "none" ? undefined : v })}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background/40">
                        <SelectValue placeholder={t("settings.fields.shader.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("settings.fields.shader.placeholder")}</SelectItem>
                        <SelectItem value="crt">CRT</SelectItem>
                        <SelectItem value="smooth">Smooth</SelectItem>
                        <SelectItem value="scanlines">Scanlines</SelectItem>
                        <SelectItem value="lcd">LCD</SelectItem>
                        <SelectItem value="phosphor">Phosphor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 flex flex-col justify-end pb-1">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <Label className="text-[10px] uppercase font-mono text-muted-foreground">Integer Scale</Label>
                      <Switch
                        className="scale-75 origin-right"
                        checked={!!display.integerScale}
                        onCheckedChange={(v) => update({ integerScale: v })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

const ALL_SYSTEMS = [
  { id: "nes", label: "NES" }, { id: "snes", label: "SNES" },
  { id: "genesis", label: "Genesis" }, { id: "n64", label: "N64" },
  { id: "gb", label: "GB" }, { id: "gbc", label: "GBC" },
  { id: "gba", label: "GBA" }, { id: "nds", label: "NDS" },
  { id: "ps1", label: "PS1" }, { id: "ps2", label: "PS2" },
  { id: "psp", label: "PSP" }, { id: "dreamcast", label: "DC" },
  { id: "arcade", label: "Arcade" },
];
const ALL_STATUSES = [
  { id: "unset", label: "Unset" }, { id: "playing", label: "Playing" },
  { id: "beaten", label: "Beaten" }, { id: "completed", label: "Completed" },
];

function SmartFilterCollectionCreator() {
  const { config, setConfig } = useIntegration();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [systems, setSystems] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [minMinutes, setMinMinutes] = useState<number>(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [genre, setGenre] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = <T,>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const handleCreate = async () => {
    if (!name.trim()) return;
    const rules: SmartFilterRules = {};
    if (systems.length)  rules.systems = systems;
    if (statuses.length) rules.playStatus = statuses;
    if (minRating > 0)   rules.minRating = minRating;
    if (minMinutes > 0)  rules.minMinutesPlayed = minMinutes;
    if (favoritesOnly)   rules.favorites = true;
    if (genre.trim())    rules.genre = genre.trim();

    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/collections/smart", { name: name.trim(), rules });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Error");
      await queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({ title: "Smart filter created", description: `"${name.trim()}" will update automatically.` });
      setOpen(false);
      setName(""); setSystems([]); setStatuses([]);
      setMinRating(0); setMinMinutes(0); setFavoritesOnly(false); setGenre("");
    } catch (err) {
      toast({ title: "Failed to create", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title={t("settings.sections.smartFilters.title")}
      description={t("settings.sections.smartFilters.description")}>
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}
          className="gap-1.5" data-testid="button-create-smart-filter">
          <Sparkles className="size-3.5" /> {t("settings.buttons.create")}
        </Button>
      ) : (
        <div className="rounded-xl border border-border bg-black/30 p-4 space-y-4">
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t("home.prompts.collectionName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Currently Playing"
              data-testid="input-smart-filter-name"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("nav.browseSystems")} <span className="opacity-50">(empty = all)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SYSTEMS.map(({ id, label }) => (
                <button key={id} type="button"
                  onClick={() => setSystems((s) => toggle(s, id))}
                  className={`px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-all ${
                    systems.includes(id)
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("history.stats.playStatus")} <span className="opacity-50">(empty = any)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(({ id, label }) => (
                <button key={id} type="button"
                  onClick={() => setStatuses((s) => toggle(s, id))}
                  className={`px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-wider transition-all ${
                    statuses.includes(id)
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Min rating (0 = any)</Label>
              <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-border bg-background/50 px-2 font-mono text-xs text-foreground"
                data-testid="select-smart-filter-min-rating">
                <option value={0}>Any</option>
                {[1,2,3,4,5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Min playtime</Label>
              <select value={minMinutes} onChange={(e) => setMinMinutes(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-border bg-background/50 px-2 font-mono text-xs text-foreground">
                <option value={0}>Any</option>
                <option value={10}>10 min</option>
                <option value={60}>1 hour</option>
                <option value={300}>5 hours</option>
                <option value={1200}>20 hours</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Genre contains</Label>
              <Input value={genre} onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. RPG" className="font-mono text-xs"
                data-testid="input-smart-filter-genre" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch id="sf-favorites" checked={favoritesOnly} onCheckedChange={setFavoritesOnly} />
              <Label htmlFor="sf-favorites" className="text-sm">Favorites only</Label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleCreate} disabled={!name.trim() || saving} className="gap-1.5"
              data-testid="button-save-smart-filter">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {t("settings.buttons.create")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("settings.buttons.cancel")}</Button>
          </div>
        </div>
      )}
    </Section>
  );
}

interface ScannerStatusData {
  enabled: boolean;
  watchDir: string | null;
  lastScanAt: number | null;
  lastScanFound: number;
  totalScanned: number;
  watching: boolean;
  error: string | null;
}

function ScannerStatusSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const { data: status } = useQuery<ScannerStatusData>({
    queryKey: ["/api/scanner/status"],
    refetchInterval: 30_000,
  });

  const handleScanNow = async () => {
    setScanning(true);
    try {
      await apiRequest("POST", "/api/scanner/scan-now");
      await queryClient.invalidateQueries({ queryKey: ["/api/scanner/status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
      toast({ title: "Scan complete", description: `Found ${status?.lastScanFound ?? 0} new ROM(s).` });
    } catch (err) {
      toast({ title: "Scan failed", description: String(err), variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  if (!status?.enabled) {
    return (
      <Section title={t("settings.sections.scanner.title")}
        description={t("settings.sections.scanner.disabledDescription")}>
        <p className="text-sm text-muted-foreground">
          Not active — set{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">CABINET_ROM_WATCH_DIR</code>{" "}
          in the add-on config to enable automatic ROM imports.
        </p>
      </Section>
    );
  }

  return (
    <Section title={t("settings.sections.scanner.title")}
      description={t("settings.sections.scanner.enabledDescription")}>
      <div className="space-y-3">
        <div className="flex items-center gap-x-3 gap-y-1 text-sm font-mono">
          <span className="text-muted-foreground">Watch dir:</span>
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{status.watchDir}</code>
          {status.watching && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
              <span className="size-1.5 rounded-full bg-green-400 animate-pulse" /> {t("common.ui.active")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground font-mono">
          <span>Total imported: <span className="text-foreground">{status.totalScanned}</span></span>
          {status.lastScanAt ? (
            <span>Last scan: <span className="text-foreground">{new Date(status.lastScanAt).toLocaleTimeString()}</span></span>
          ) : null}
          {(status.lastScanFound ?? 0) > 0 && (
            <span className="text-primary">+{status.lastScanFound} last run</span>
          )}
        </div>

        {status.error ? (
          <p className="text-xs text-destructive font-mono">{status.error}</p>
        ) : null}

        <Button variant="outline" size="sm" onClick={handleScanNow} disabled={scanning}
          className="gap-1.5" data-testid="button-scan-now">
          {scanning ? <Loader2 className="size-3.5 animate-spin" /> : <ScanLine className="size-3.5" />}
          {t("settings.buttons.scanNow")}
        </Button>
      </div>
    </Section>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5 mb-4 max-w-prose">{description}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 size-6 rounded-full bg-arcade-gradient text-white font-mono text-[12px] font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-sm">{title}</div>
        <div className="text-sm text-muted-foreground mt-1 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-foreground/80">
          {children}
        </div>
      </div>
    </li>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 rounded-md border border-border bg-background/60 p-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-foreground/90 max-w-full">
      <code>{children}</code>
    </pre>
  );
}

function ControlsSettings() {
  const { config, setConfig } = useIntegration();
  const { t } = useTranslation();
  const [gamepads, setGamepads] = useState<Gamepad[]>([]);
  const [pressedButtons, setPressedButtons] = useState<Record<number, number[]>>({});

  useEffect(() => {
    const update = () => {
      const activeGps = navigator.getGamepads?.().filter((g): g is Gamepad => g !== null) ?? [];
      setGamepads(activeGps);

      const nextPressed: Record<number, number[]> = {};
      activeGps.forEach((gp) => {
        const pressed: number[] = [];
        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed) pressed.push(idx);
        });
        nextPressed[gp.index] = pressed;
      });
      setPressedButtons(nextPressed);
    };

    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    const timer = setInterval(update, 100); // Faster poll for the tester
    return () => {
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-10">
      <Section
        title={t("settings.sections.input.title")}
        description={t("settings.sections.input.description")}
      >
        <div className="grid gap-6">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-sidebar/40">
            <div className="space-y-0.5">
              <div className="font-display font-semibold text-sm">{t("settings.fields.rumble.label")}</div>
              <div className="text-xs text-muted-foreground">{t("settings.fields.rumble.hint")}</div>
            </div>
            <Switch
              checked={config.gamepadRumble}
              onCheckedChange={(v) => setConfig({ gamepadRumble: v })}
            />
          </div>
        </div>
      </Section>

      <Section
        title={t("settings.sections.controllers.title")}
        description={t("settings.sections.controllers.description")}
      >
        {gamepads.length === 0 ? (
          <div className="p-8 rounded-lg border border-dashed border-border bg-sidebar/10 flex flex-col items-center text-center gap-3">
            <Gamepad2 className="size-8 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-sm font-medium">No controllers detected</p>
              <p className="text-xs text-muted-foreground">Connect a USB or Bluetooth controller and press a button.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {gamepads.map((gp) => (
              <div key={gp.index} className="p-5 rounded-xl border border-border bg-sidebar/20 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Gamepad2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{gp.id}</div>
                    <div className="flex gap-3 mt-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Index: {gp.index}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{gp.buttons.length} Buttons</span>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded bg-green-500/10 text-green-500 font-mono text-[10px] font-bold uppercase tracking-wider">
                    Connected
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                   {gp.buttons.map((_, idx) => (
                     <div
                       key={idx}
                       className={`size-7 rounded flex items-center justify-center font-mono text-[10px] border transition-colors ${
                         pressedButtons[gp.index]?.includes(idx)
                           ? "bg-primary border-primary text-primary-foreground scale-110 shadow-[0_0_12px_hsl(var(--primary))]"
                           : "bg-background/40 border-border text-muted-foreground"
                       }`}
                     >
                       {idx}
                     </div>
                   ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={t("settings.sections.shortcuts.title")}
        description={t("settings.sections.shortcuts.description")}
      >
        <div className="grid sm:grid-cols-2 gap-3">
           <Shortcut keyName="Arrow Keys" action="Navigate Grid" />
           <Shortcut keyName="Enter" action="Open Game" />
           <Shortcut keyName="F" action="Toggle Favorite" />
           <Shortcut keyName="/" action="Focus Search" />
           <Shortcut keyName="Esc" action="Close Dialog / Back" />
           <Shortcut keyName="S" action="Quick Save (in-game)" />
           <Shortcut keyName="L" action="Quick Load (in-game)" />
           <Shortcut keyName="1-9" action="Change Save Slot" />
        </div>
      </Section>

      <Section
        title={t("settings.sections.mapping.title")}
        description={t("settings.sections.mapping.description")}
      >
        <div className="grid gap-3">
          {[
            { id: "select",   label: "Select / Open" },
            { id: "back",     label: "Back / Close" },
            { id: "favorite", label: "Toggle Favorite" },
            { id: "menu",     label: "System Menu" },
          ].map((action) => (
            <div key={action.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-sidebar/40">
              <div className="space-y-0.5">
                <div className="font-display font-semibold text-sm">{action.label}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Action: {action.id}</div>
              </div>
              <RemapButton
                actionId={action.id}
                currentValue={config.uiGamepadMapping?.[action.id]}
                onMap={(btn) => {
                  const mapping = { ...(config.uiGamepadMapping || {}) };
                  mapping[action.id] = btn;
                  setConfig({ uiGamepadMapping: mapping });
                }}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function RemapButton({ actionId, currentValue, onMap }: { actionId: string; currentValue?: number; onMap: (btn: number) => void }) {
  const { t } = useTranslation();
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    let rafId: number;
    const poll = () => {
      const gps = navigator.getGamepads?.();
      for (const gp of gps || []) {
        if (!gp) continue;
        const pressedIdx = gp.buttons.findIndex(b => b.pressed);
        if (pressedIdx !== -1) {
          onMap(pressedIdx);
          setListening(false);
          return;
        }
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [listening, onMap]);

  return (
    <Button
      variant={listening ? "default" : "outline"}
      size="sm"
      onClick={() => setListening(!listening)}
      className={`min-w-[100px] gap-2 ${listening ? "animate-pulse ring-2 ring-primary" : ""}`}
    >
      {listening ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Press any button...
        </>
      ) : (
        <>
          <kbd className="font-mono text-[10px] opacity-70">BTN {currentValue ?? "?"}</kbd>
          {t("settings.buttons.remap")}
        </>
      )}
    </Button>
  );
}

function Shortcut({ keyName, action }: { keyName: string; action: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-sidebar/10">
       <span className="text-xs text-muted-foreground">{action}</span>
       <kbd className="px-2 py-1 rounded bg-muted font-mono text-[10px] font-bold text-foreground border-b-2 border-muted-foreground/30">{keyName}</kbd>
    </div>
  );
}

function ServicesSettings() {
  const { config, setConfig } = useIntegration();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [scraping, setScraping] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; title?: string } | null>(null);

  const handleBulkScrape = async () => {
    if (scraping) return;
    setScraping(true);
    setProgress(null);

    try {
      const res = await fetch("/api/roms/scrape-all", { method: "POST" });
      if (!res.ok) throw new Error(res.statusText);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Body reader not available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "progress") {
                setProgress({ current: data.current, total: data.total, title: data.title });
              } else if (data.type === "complete") {
                toast({ title: "Bulk scrape complete", description: "Successfully refreshed art for all ROMs." });
                await queryClient.invalidateQueries({ queryKey: ["/api/roms"] });
              }
            } catch (err) {
              console.error("Failed to parse SSE line", err);
            }
          }
        }
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Bulk scrape failed",
        description: err instanceof Error ? err.message : "Network error during bulk scrape.",
      });
    } finally {
      setScraping(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-10">
      <Section
        title={t("settings.sections.scrapers.title")}
        description={t("settings.sections.scrapers.description")}
      >
        <div className="grid sm:grid-cols-2 gap-6">
          <Field label={t("settings.fields.tgdbApiKey.label")} hint={t("settings.fields.tgdbApiKey.hint")}>
            <Input
              value={config.tgdbApiKey}
              onChange={(e) => setConfig({ tgdbApiKey: e.target.value })}
              placeholder="Your API Key"
              className="font-mono text-sm"
            />
          </Field>
          <div className="grid gap-4">
            <Field label={t("settings.fields.ssUserId.label")}>
              <Input
                value={config.ssUserId}
                onChange={(e) => setConfig({ ssUserId: e.target.value })}
                placeholder="Username"
                className="font-mono text-sm"
              />
            </Field>
            <Field label={t("settings.fields.ssPassword.label")}>
              <Input
                type="password"
                value={config.ssPassword}
                onChange={(e) => setConfig({ ssPassword: e.target.value })}
                placeholder="••••••••"
                className="font-mono text-sm"
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title={t("settings.sections.retroachievements.title")}
        description={t("settings.sections.retroachievements.description")}
      >
        <div className="grid sm:grid-cols-2 gap-6">
          <Field label={t("settings.fields.raUsername.label")}>
            <div className="relative">
              <Trophy className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={config.raUsername}
                onChange={(e) => setConfig({ raUsername: e.target.value })}
                placeholder="RA Username"
                className="pl-9 font-mono text-sm"
              />
            </div>
          </Field>
          <Field label={t("settings.fields.raToken.label")} hint={t("settings.fields.raToken.hint")}>
            <Input
              type="password"
              value={config.raToken}
              onChange={(e) => setConfig({ raToken: e.target.value })}
              placeholder="RA API Key"
              className="font-mono text-sm"
            />
          </Field>
        </div>
      </Section>

      <Section
        title={t("settings.sections.bulk.title")}
        description={t("settings.sections.bulk.description")}
      >
        <div className="p-5 rounded-xl border border-border bg-sidebar/20 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="font-display font-semibold text-sm flex items-center gap-2">
                <Image className="size-4 text-primary" />
                Scrape All ROMs
              </div>
              <div className="text-xs text-muted-foreground">
                Iterates through all unscraped or failed ROMs and attempts to fetch metadata.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkScrape}
              disabled={scraping}
              className="gap-2"
            >
              {scraping ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {t("settings.buttons.scrapeAll")}
            </Button>
          </div>

          {progress && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider">
                <span className="text-primary truncate max-w-[200px]">{progress.title || "Processing..."}</span>
                <span className="text-muted-foreground">{progress.current} / {progress.total}</span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} className="h-1.5" />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function KioskSettings() {
  const { config, setConfig } = useIntegration();
  const { t } = useTranslation();
  const { data: collections = [] } = useQuery<GameCollectionWithItems[]>({ queryKey: ["/api/collections"] });

  return (
    <div className="space-y-10">
      <Section
        title={t("settings.sections.kiosk.title")}
        description={t("settings.sections.kiosk.description")}
      >
        <div className="grid gap-6">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-sidebar/40">
            <div className="space-y-0.5">
              <div className="font-display font-semibold text-sm">Enable Kiosk Mode</div>
              <div className="text-xs text-muted-foreground">Restricts navigation and hides technical settings.</div>
            </div>
            <Switch
              checked={config.kioskMode}
              onCheckedChange={(v) => setConfig({ kioskMode: v })}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <Field label={t("settings.fields.kioskPin.label")} hint={t("settings.fields.kioskPin.hint")}>
              <Input
                value={config.kioskPin}
                onChange={(e) => setConfig({ kioskPin: e.target.value })}
                placeholder="e.g. 1234"
                className="font-mono text-sm"
                maxLength={8}
              />
            </Field>

            <Field label={t("settings.fields.kioskCollection.label")} hint={t("settings.fields.kioskCollection.hint")}>
              <Select
                value={config.kioskCollectionId?.toString() ?? "all"}
                onValueChange={(v) => setConfig({ kioskCollectionId: v === "all" ? null : parseInt(v, 10) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("settings.fields.kioskCollection.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("settings.fields.kioskCollection.placeholder")}</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </Section>
    </div>
  );
}
