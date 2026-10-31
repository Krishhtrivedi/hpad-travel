"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { decideRequest } from "@/app/actions/requests";
import { Alert, Button, Card, CardBody, CardHeader, Field, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";

export function DecisionPanel({ requestId, requestNumber, employeeName }: { requestId: string; requestNumber: string; employeeName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    if (pending) return;
    setMode(null);
    setError(null);
  };

  const confirm = () => {
    if (!mode) return;
    if (mode === "reject" && !comments.trim()) {
      setError("Please give a reason for rejecting this request.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await decideRequest({ requestId, decision: mode, comments: comments.trim() || undefined });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(mode === "approve" ? "Request approved. The employee has been notified." : "Request rejected. The employee has been notified.");
      setMode(null);
      setComments("");
      router.refresh();
    });
  };

  if (done) return <Alert tone="success">{done}</Alert>;

  return (
    <Card className="no-print">
      <CardHeader title="Your decision" description="This request is waiting for your review." />
      <CardBody className="flex flex-col sm:flex-row gap-3">
        <Button variant="success" size="lg" onClick={() => setMode("approve")} className="w-full sm:w-auto justify-center">
          <CheckCircle2 className="h-4 w-4" /> Approve request
        </Button>
        <Button variant="danger" size="lg" onClick={() => setMode("reject")} className="w-full sm:w-auto justify-center">
          <XCircle className="h-4 w-4" /> Reject request
        </Button>
      </CardBody>

      <Dialog
        open={mode !== null}
        onClose={close}
        title={mode === "approve" ? `Approve ${requestNumber}?` : `Reject ${requestNumber}?`}
        description={`${employeeName} will be notified straight away. This decision is permanent.`}
      >
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field
            label={mode === "approve" ? "Comments (optional)" : "Reason for rejection"}
            htmlFor="decision-comments"
            required={mode === "reject"}
          >
            <Textarea
              id="decision-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              maxLength={2000}
              placeholder={mode === "approve" ? "Anything the employee should know" : "Explain why so the employee can act on it"}
              autoFocus
            />
          </Field>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
            <Button variant="secondary" onClick={close} disabled={pending} className="w-full sm:w-auto justify-center">
              Cancel
            </Button>
            <Button variant={mode === "approve" ? "success" : "danger"} onClick={confirm} loading={pending} className="w-full sm:w-auto justify-center">
              {mode === "approve" ? "Confirm approval" : "Confirm rejection"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
