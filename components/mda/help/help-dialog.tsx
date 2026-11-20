"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  EditorialTabs,
  EditorialTabsContent,
  EditorialTabsList,
  EditorialTabsTrigger,
  editorialButtonClass,
} from "@/app/deck-archives/editorial-ui";
import { sendFeedback } from "@/app/help/actions";
import { useDeck } from "@/context/deck-context";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_INITIAL_STATE,
  FEEDBACK_MESSAGE_MAX,
  HELP_ANSWERS,
  SCREENSHOT_MAX_BYTES,
  hashDeckId,
  redactRoute,
  screenshotErrorMessage,
  validateFeedbackFields,
} from "@/lib/help/feedback";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const fieldClass =
  "min-h-11 w-full border border-[#28303b] bg-[#0c0e12] px-3 text-[15px] leading-6 text-[#e2e8f0] placeholder:text-[#8a96a6] focus:border-[#bfe5f3] focus:outline-none focus-visible:border-[#bfe5f3]";

/**
 * Help hub opened from the avatar menu.
 * Answers and the report form are separate segments so a bug report
 * is not buried under the FAQ.
 */
export function HelpDialog({
  open,
  onOpenChange,
  pathname,
  deckId = null,
  deckFormat = null,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog does not read the live deck. Stories pass this. */
  pathname?: string;
  deckId?: string | null;
  deckFormat?: string | null;
  /** Avatar trigger. The menu item that opens Help unmounts, so focus returns here. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}): ReactNode {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[rgba(12,14,18,0.88)]" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[81] flex max-h-[min(90vh,760px)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col border border-[#28303b] bg-[#14181f] font-geist text-[#e2e8f0] outline-none"
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef?.current) return;
            event.preventDefault();
            returnFocusRef.current.focus();
          }}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#28303b] px-6 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-orbitron text-[13px] font-semibold uppercase tracking-wider text-white">
                Help
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 font-orbitron text-[12px] uppercase tracking-wider text-[#8a96a6]">
                Answers, or a report if something is wrong
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#28303b] bg-[#14181f] text-[#e2e8f0] hover:bg-[#e2e8f0] hover:text-[#14181f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]"
              aria-label="Close help"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </DialogPrimitive.Close>
          </div>
          {pathname !== undefined ? (
            <HelpDialogBody pathname={pathname} deckId={deckId} deckFormat={deckFormat} />
          ) : (
            <ConnectedHelpDialogBody />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ConnectedHelpDialogBody(): ReactNode {
  const pathname = usePathname() ?? "";
  const { currentDeck } = useDeck();
  return (
    <HelpDialogBody
      pathname={pathname}
      deckId={currentDeck?.id ?? null}
      deckFormat={currentDeck?.deckFormat ?? null}
    />
  );
}

function HelpDialogBody({
  pathname,
  deckId,
  deckFormat,
}: {
  pathname: string;
  deckId: string | null;
  deckFormat: string | null;
}): ReactNode {
  return (
    <EditorialTabs defaultValue="answers" className="flex min-h-0 flex-1 flex-col">
      <EditorialTabsList className="mb-0 shrink-0 gap-2 border-b border-[#28303b] px-6 py-3">
        <EditorialTabsTrigger value="answers">Answers</EditorialTabsTrigger>
        <EditorialTabsTrigger value="report">Report</EditorialTabsTrigger>
      </EditorialTabsList>
      <EditorialTabsContent value="answers" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <HelpAnswers />
      </EditorialTabsContent>
      <EditorialTabsContent
        value="report"
        forceMount
        className="min-h-0 flex-1 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden"
      >
        <HelpReportForm pathname={pathname} deckId={deckId} deckFormat={deckFormat} />
      </EditorialTabsContent>
    </EditorialTabs>
  );
}

function HelpAnswers(): ReactNode {
  return (
    <div className="border border-[#28303b]">
      {HELP_ANSWERS.map((answer) => (
        <details key={answer.id} className="border-b border-[#28303b] last:border-b-0">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 font-orbitron text-[12px] font-semibold uppercase tracking-wider text-[#e2e8f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#bfe5f3]">
            {answer.title}
          </summary>
          <p className="px-3 pb-4 text-[15px] leading-6 text-[#e2e8f0]">{answer.body}</p>
        </details>
      ))}
    </div>
  );
}

function HelpReportForm({
  pathname,
  deckId,
  deckFormat,
}: {
  pathname: string;
  deckId: string | null;
  deckFormat: string | null;
}): ReactNode {
  const summaryRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(FEEDBACK_INITIAL_STATE);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [deckHash, setDeckHash] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const remaining = FEEDBACK_MESSAGE_MAX - message.length;
  const problems = problemList(state, fileError);

  useEffect(() => {
    const id = deckId;
    if (!id) {
      setDeckHash("");
      return;
    }
    let cancelled = false;
    void hashDeckId(id).then((hash) => {
      if (!cancelled) setDeckHash(hash);
    });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const serverProblemKey = [
    state.error,
    state.fieldErrors?.category,
    state.fieldErrors?.message,
    state.fieldErrors?.screenshot,
  ]
    .filter(Boolean)
    .join("|");

  useEffect(() => {
    if (serverProblemKey) summaryRef.current?.focus();
  }, [serverProblemKey]);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fieldErrors = validateFeedbackFields({
      category: String(formData.get("category") ?? ""),
      message: String(formData.get("message") ?? ""),
    });
    if (fieldErrors || fileError) {
      setState({ success: false, fieldErrors: fieldErrors ?? undefined });
      return;
    }
    setPending(true);
    try {
      const result = await sendFeedback(state, formData);
      setState(result);
    } catch {
      setState({ success: false, error: "The report could not be sent. Try again." });
    } finally {
      setPending(false);
    }
  }

  if (state.success && state.ticketId) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="font-orbitron text-[13px] font-semibold uppercase tracking-wider text-white">
          Report received
        </p>
        <p className="text-[15px] leading-6 text-[#e2e8f0]">
          Reference {state.ticketId}
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        void submitReport(event);
      }}
    >
      {problems.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="border border-[#8f2d2d] bg-[#0c0e12] px-3 py-3 outline-none"
        >
          <p className="font-orbitron text-[12px] font-semibold uppercase tracking-wider text-[#f0c4c4]">
            There is a problem
          </p>
          <ul className="mt-2 list-disc pl-5 text-[15px] leading-6 text-[#f0c4c4]">
            {problems.map((problem) => (
              <li key={problem.href}>
                <a className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]" href={problem.href}>
                  {problem.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-2" id="help-category" tabIndex={-1}>
        <legend className="font-orbitron text-[12px] font-semibold uppercase tracking-wider text-[#e2e8f0]">
          Category
        </legend>
        <div className="flex flex-col gap-2">
          {FEEDBACK_CATEGORIES.map((category) => (
            <label
              key={category.value}
              className="flex min-h-11 cursor-pointer items-center gap-3 border border-[#28303b] px-3 text-[15px] text-[#e2e8f0] has-[:focus-visible]:border-[#bfe5f3]"
            >
              <input
                type="radio"
                name="category"
                value={category.value}
                required
                className="h-4 w-4 accent-[#bfe5f3]"
              />
              {category.label}
            </label>
          ))}
        </div>
        {state.fieldErrors?.category ? (
          <p id="help-category-error" className="text-[15px] leading-6 text-[#f0c4c4]">
            {state.fieldErrors.category}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="help-message" className="font-orbitron text-[12px] font-semibold uppercase tracking-wider text-[#e2e8f0]">
          What happened
        </label>
        <textarea
          id="help-message"
          name="message"
          required
          maxLength={FEEDBACK_MESSAGE_MAX}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-invalid={state.fieldErrors?.message ? true : undefined}
          aria-describedby="help-message-hint"
          className={cn(fieldClass, "min-h-32 py-2")}
        />
        <p id="help-message-hint" className="text-[12px] uppercase tracking-wider text-[#8a96a6]">
          {remaining} characters left
        </p>
        {state.fieldErrors?.message ? (
          <p className="text-[15px] leading-6 text-[#f0c4c4]">{state.fieldErrors.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="help-screenshot" className="font-orbitron text-[12px] font-semibold uppercase tracking-wider text-[#e2e8f0]">
          Screenshot, optional
        </label>
        <p id="help-screenshot-hint" className="text-[15px] leading-6 text-[#e2e8f0]">
          PNG, JPEG, or WebP. Smaller than 2 MB.
        </p>
        <input
          ref={fileRef}
          id="help-screenshot"
          name="screenshot"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-describedby="help-screenshot-hint"
          aria-invalid={fileError || state.fieldErrors?.screenshot ? true : undefined}
          className={cn(fieldClass, "py-2 file:mr-3 file:border-0 file:bg-transparent file:font-orbitron file:text-[12px] file:font-semibold file:uppercase file:tracking-wider file:text-[#e2e8f0]")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setFileName(null);
              setFileError(null);
              return;
            }
            if (file.size === 0) setFileError(screenshotErrorMessage("empty"));
            else if (file.size > SCREENSHOT_MAX_BYTES) setFileError(screenshotErrorMessage("too-big"));
            else if (!ACCEPTED_TYPES.has(file.type)) setFileError(screenshotErrorMessage("type"));
            else setFileError(null);
            setFileName(file.name);
          }}
        />
        {fileName ? (
          <div className="flex min-h-11 items-center justify-between gap-3 border border-[#28303b] px-3">
            <p className="truncate text-[15px] text-[#e2e8f0]">{fileName}</p>
            <button
              type="button"
              className="min-h-11 shrink-0 text-[12px] font-semibold uppercase tracking-wider text-[#e2e8f0] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfe5f3]"
              onClick={() => {
                if (fileRef.current) fileRef.current.value = "";
                setFileName(null);
                setFileError(null);
              }}
            >
              Remove
            </button>
          </div>
        ) : null}
        {fileError || state.fieldErrors?.screenshot ? (
          <p className="text-[15px] leading-6 text-[#f0c4c4]">
            {fileError ?? state.fieldErrors?.screenshot}
          </p>
        ) : null}
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-3 border border-[#28303b] px-3 py-2 text-[15px] leading-6 text-[#e2e8f0] has-[:focus-visible]:border-[#bfe5f3]">
        <input
          type="checkbox"
          name="includeDiagnostics"
          checked={includeDiagnostics}
          onChange={(event) => setIncludeDiagnostics(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#bfe5f3]"
        />
        <span>
          Include diagnostics
          <span className="mt-1 block text-[15px] leading-6 text-[#8a96a6]">
            Route, build, format, and a hash of the deck id. The deck id itself is not sent.
          </span>
        </span>
      </label>
      {includeDiagnostics ? (
        <>
          <input type="hidden" name="route" value={redactRoute(pathname)} />
          <input type="hidden" name="deckFormat" value={deckFormat ?? ""} />
          <input type="hidden" name="deckIdHash" value={deckHash} />
        </>
      ) : null}

      <button type="submit" className={editorialButtonClass} disabled={pending}>
        {pending ? "Sending" : "Send report"}
      </button>
    </form>
  );
}

function problemList(
  state: { error?: string; fieldErrors?: { category?: string; message?: string; screenshot?: string } },
  fileError: string | null,
): { href: string; label: string }[] {
  const problems: { href: string; label: string }[] = [];
  if (state.error) problems.push({ href: "#help-message", label: state.error });
  if (state.fieldErrors?.category) problems.push({ href: "#help-category", label: state.fieldErrors.category });
  if (state.fieldErrors?.message) problems.push({ href: "#help-message", label: state.fieldErrors.message });
  const screenshot = fileError ?? state.fieldErrors?.screenshot;
  if (screenshot) problems.push({ href: "#help-screenshot", label: screenshot });
  return problems;
}
