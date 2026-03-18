"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Unplug } from "lucide-react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";

import {
  saveTelegramSettings,
  testTelegramConnection,
  disconnectTelegram,
} from "../actions";
import type { TestConnectionResult } from "../actions";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TelegramConnectionProps {
  botToken: string;
  chatId: string;
  topicId: string;
  configured: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TelegramConnection({ botToken, chatId, topicId, configured }: TelegramConnectionProps) {
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  function clearMessages() {
    setError(null);
    setSuccess(null);
    setTestResult(null);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    clearMessages();

    const formData = new FormData(e.currentTarget);
    const result = await saveTelegramSettings(formData);

    setSaving(false);
    if (result.success) {
      setSuccess("Telegram settings saved");
    } else {
      setError(result.error);
    }
  }

  async function handleTest() {
    setTesting(true);
    clearMessages();
    const result = await testTelegramConnection();
    setTestResult(result);
    setTesting(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    clearMessages();
    const result = await disconnectTelegram();
    setDisconnecting(false);
    if (!result.success) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h3 className="text-base font-medium text-white">Telegram</h3>
        <Badge variant={configured ? "default" : "secondary"}>
          {configured ? "Connected" : "Not connected"}
        </Badge>
      </div>

      <p className="text-sm text-slate-400">
        Receive real-time lead notifications in your Telegram group.
        Create a bot via{" "}
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-300"
        >
          @BotFather
        </a>
        , then add it to your group and get the Chat ID.
      </p>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tg-bot-token">Bot Token</Label>
          <Input
            id="tg-bot-token"
            name="botToken"
            type="password"
            defaultValue={botToken}
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            className="max-w-lg"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tg-chat-id">Chat ID</Label>
          <Input
            id="tg-chat-id"
            name="chatId"
            defaultValue={chatId}
            placeholder="-1001234567890"
            className="max-w-lg"
          />
          <p className="text-xs text-slate-500">
            Group chat ID (starts with -100). Use @RawDataBot to find it.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tg-topic-id">Topic ID (optional)</Label>
          <Input
            id="tg-topic-id"
            name="topicId"
            defaultValue={topicId}
            placeholder="123"
            className="max-w-lg"
          />
          <p className="text-xs text-slate-500">
            Message thread ID for groups with topics enabled. Leave empty for general chat.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={testing || !configured}
            onClick={handleTest}
          >
            {testing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Send Test Message
          </Button>

          {configured && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
              disabled={disconnecting}
              onClick={handleDisconnect}
            >
              {disconnecting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-1.5 h-4 w-4" />
              )}
              Disconnect
            </Button>
          )}
        </div>
      </form>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      {testResult && (
        <div
          className={`flex items-center gap-2 text-sm ${
            testResult.success ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {testResult.success ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Test message sent successfully!
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 shrink-0" />
              {testResult.error}
            </>
          )}
        </div>
      )}
    </div>
  );
}
