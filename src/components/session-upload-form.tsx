"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  MAX_SESSION_UPLOAD_FILES,
  MULTIPART_UPLOAD_THRESHOLD_BYTES,
  SESSION_UPLOAD_ACCEPT,
  buildSessionUploadPathname,
  formatFileSize,
  getSessionUploadContentType,
  getSessionUploadIssue,
  type UploadedSessionFile,
} from "@/lib/session-upload";

interface SessionUploadFormProps {
  selectedServiceName?: string;
  defaultArtistName?: string;
  defaultEmail?: string;
  paymentReference?: string;
  paymentReady?: boolean;
}

interface UploadRow {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "complete" | "error";
}

const EMPTY_SUCCESS = "";

function getUploadRowId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export default function SessionUploadForm({
  selectedServiceName,
  defaultArtistName,
  defaultEmail,
  paymentReference,
  paymentReady = false,
}: SessionUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [artistName, setArtistName] = useState(defaultArtistName || "");
  const [email, setEmail] = useState(defaultEmail || "");
  const [projectTitle, setProjectTitle] = useState("");
  const [bpm, setBpm] = useState("");
  const [keySignature, setKeySignature] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState(EMPTY_SUCCESS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultArtistName && !artistName) {
      setArtistName(defaultArtistName);
    }
  }, [artistName, defaultArtistName]);

  useEffect(() => {
    if (defaultEmail && !email) {
      setEmail(defaultEmail);
    }
  }, [defaultEmail, email]);

  const totalUploadSize = useMemo(() => {
    return selectedFiles.reduce((sum, file) => sum + file.size, 0);
  }, [selectedFiles]);

  function resetFileSelection() {
    setSelectedFiles([]);
    setUploadRows([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function setRowStatus(fileId: string, nextStatus: UploadRow["status"], progress?: number) {
    setUploadRows((current) =>
      current.map((row) =>
        row.id === fileId
          ? {
              ...row,
              status: nextStatus,
              progress: typeof progress === "number" ? progress : row.progress,
            }
          : row
      )
    );
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files || []);
    setErrorMessage("");
    setSuccessMessage(EMPTY_SUCCESS);

    if (!paymentReady || !paymentReference) {
      setErrorMessage("Payment must be confirmed before sending session files.");
      resetFileSelection();
      return;
    }

    if (!nextFiles.length) {
      resetFileSelection();
      return;
    }

    if (nextFiles.length > MAX_SESSION_UPLOAD_FILES) {
      setErrorMessage(`Upload up to ${MAX_SESSION_UPLOAD_FILES} files at a time.`);
      resetFileSelection();
      return;
    }

    for (const file of nextFiles) {
      const issue = getSessionUploadIssue(file);

      if (issue) {
        setErrorMessage(issue);
        resetFileSelection();
        return;
      }
    }

    setSelectedFiles(nextFiles);
    setUploadRows(
      nextFiles.map((file) => ({
        id: getUploadRowId(file),
        name: file.name,
        size: file.size,
        progress: 0,
        status: "queued",
      }))
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage(EMPTY_SUCCESS);

    if (!artistName.trim() || !email.trim() || !projectTitle.trim()) {
      setErrorMessage("Artist name, email, and project title are required.");
      return;
    }

    if (!paymentReady || !paymentReference) {
      setErrorMessage("Payment must be confirmed before sending session files.");
      return;
    }

    if (!selectedFiles.length) {
      setErrorMessage("Add stems, a zipped session, or a beat file before sending the project.");
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedFiles: UploadedSessionFile[] = [];

      for (const file of selectedFiles) {
        const rowId = getUploadRowId(file);
        const contentType = getSessionUploadContentType(file.name, file.type);

        if (!contentType) {
          throw new Error(`"${file.name}" is not an allowed session upload file.`);
        }

        setRowStatus(rowId, "uploading", 1);

        const blob = await upload(buildSessionUploadPathname(projectTitle, file.name), file, {
          access: "public",
          contentType,
          handleUploadUrl: "/api/uploads/session",
          multipart: file.size >= MULTIPART_UPLOAD_THRESHOLD_BYTES,
          clientPayload: JSON.stringify({
            originalName: file.name,
            contentType,
            paymentReference,
          }),
          onUploadProgress: ({ percentage }) => {
            setRowStatus(rowId, "uploading", Math.max(1, Math.round(percentage)));
          },
        });

        uploadedFiles.push({
          name: file.name,
          size: file.size,
          contentType,
          pathname: blob.pathname,
          url: blob.url,
          downloadUrl: blob.downloadUrl,
        });

        setRowStatus(rowId, "complete", 100);
      }

      const response = await fetch("/api/uploads/session/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artistName,
          email,
          projectTitle,
          serviceTier: selectedServiceName,
          bpm,
          keySignature,
          notes,
          paymentReference,
          files: uploadedFiles,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "The upload finished, but the studio could not receive the session details.");
      }

      if (result?.savedToInbox && result?.notificationSent === false) {
        setSuccessMessage(
          "Session uploaded. KDUB has the files in the studio inbox now, even though email alerts are not connected yet."
        );
      } else if (result?.savedToInbox) {
        setSuccessMessage("Session uploaded. KDUB has the files in the studio inbox and by email, so the mix can move into the queue.");
      } else {
        setSuccessMessage(
          "Session uploaded. KDUB got the files and delivery details by email, so the mix can move into the queue."
        );
      }

      resetFileSelection();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload the session files.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section-block session-upload-section" id="session-upload">
      <article className="panel session-upload-panel" data-reveal="left" data-parallax="0.02">
        <div className="session-upload-copy">
          <p className="eyebrow">Client Upload Portal</p>
          <h2>Send stems, beats, and notes without leaving the site.</h2>
          <p>
            Artists can lock in a tier, then upload the session directly for mixing or mastering.
            Zip large sessions first if you want the handoff to move faster.
          </p>
          <div className="session-upload-badges">
            <span>{selectedServiceName || "Custom Studio Work"}</span>
            <span>ZIP + Audio Uploads</span>
            <span>Studio Inbox + Alerts</span>
          </div>
          <div className="session-upload-note-card">
            <p className="eyebrow">Best Results</p>
            <ul className="session-upload-checklist">
              <li>Export clean stems from bar 1 so the files line up fast.</li>
              <li>Upload one zipped session folder if the project has a lot of tracks.</li>
              <li>Include the beat, rough mix, or reference bounce with your notes.</li>
            </ul>
          </div>
          <p className="session-upload-helper">
            Allowed files: ZIP, WAV, AIFF, FLAC, MP3, M4A, AAC, and OGG. Upload up to{" "}
            {MAX_SESSION_UPLOAD_FILES} files at once.
          </p>
        </div>
      </article>

      <article className="panel session-upload-form-panel" data-reveal="right" data-parallax="0.02">
        {paymentReady ? (
          <p className="session-upload-banner is-ready">
            Payment confirmed. Upload the session below so the order can move straight into the mix queue.
          </p>
        ) : (
          <p className="session-upload-banner">
            Payment is required before this form unlocks, which keeps the studio inbox clear of spam.
          </p>
        )}

        {!paymentReady ? (
          <div className="session-upload-locked">
            <p className="eyebrow">Locked Until Checkout</p>
            <h3>Choose a tier and complete payment first.</h3>
            <p>
              Once payment clears, this upload form unlocks automatically and your files can go
              straight into the studio inbox.
            </p>
            <a href="#service-tiers" className="button button-primary full-width">
              Choose A Tier
            </a>
          </div>
        ) : (
        <form className="session-upload-form" onSubmit={handleSubmit}>
          <div className="session-upload-grid">
            <label className="session-upload-field">
              Artist Name
              <input
                type="text"
                name="artistName"
                placeholder="Artist, band, or client name"
                value={artistName}
                onChange={(event) => setArtistName(event.target.value)}
                required
              />
            </label>
            <label className="session-upload-field">
              Email
              <input
                type="email"
                name="email"
                placeholder="Where updates should go"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="session-upload-field">
              Project Title
              <input
                type="text"
                name="projectTitle"
                placeholder="Song title or session name"
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.target.value)}
                required
              />
            </label>
            <label className="session-upload-field">
              Selected Tier
              <div className="session-upload-readonly">{selectedServiceName || "Custom studio request"}</div>
            </label>
            <label className="session-upload-field">
              BPM
              <input
                type="text"
                name="bpm"
                placeholder="Optional tempo"
                value={bpm}
                onChange={(event) => setBpm(event.target.value)}
              />
            </label>
            <label className="session-upload-field">
              Key
              <input
                type="text"
                name="keySignature"
                placeholder="Optional key"
                value={keySignature}
                onChange={(event) => setKeySignature(event.target.value)}
              />
            </label>
          </div>

          <label className="session-upload-field session-upload-field-full">
            Session Notes
            <textarea
              name="notes"
              rows={5}
              placeholder="Reference songs, vocal notes, deadline, or anything the session should match."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <label className="session-upload-field session-upload-field-full">
            Stems And Beats
            <div className="session-upload-dropzone">
              <input
                ref={fileInputRef}
                type="file"
                name="files"
                accept={SESSION_UPLOAD_ACCEPT}
                multiple
                onChange={handleFileSelection}
              />
              <p>
                Select stems, beats, or one zipped session folder. Total selected now:{" "}
                <strong>{selectedFiles.length ? `${selectedFiles.length} files • ${formatFileSize(totalUploadSize)}` : "No files selected yet"}</strong>
              </p>
            </div>
          </label>

          {uploadRows.length ? (
            <ul className="session-upload-file-list">
              {uploadRows.map((row) => (
                <li className={`session-upload-file-item is-${row.status}`} key={row.id}>
                  <div className="session-upload-file-topline">
                    <strong>{row.name}</strong>
                    <span>{formatFileSize(row.size)}</span>
                  </div>
                  <div className="session-upload-progress-track" aria-hidden="true">
                    <span style={{ width: `${row.progress}%` }}></span>
                  </div>
                  <p className="session-upload-file-meta">
                    {row.status === "queued" && "Waiting to upload"}
                    {row.status === "uploading" && `${row.progress}% uploaded`}
                    {row.status === "complete" && "Uploaded"}
                    {row.status === "error" && "Upload error"}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          {errorMessage ? <p className="checkout-message checkout-error">{errorMessage}</p> : null}
          {successMessage ? <p className="checkout-message checkout-success">{successMessage}</p> : null}

          <div className="session-upload-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={resetFileSelection}
              disabled={isSubmitting || !selectedFiles.length}
            >
              Clear Files
            </button>
            <button type="submit" className="button button-primary" disabled={isSubmitting}>
              {isSubmitting ? "Uploading Session..." : "Send Session To KDUB"}
            </button>
          </div>

          <p className="session-upload-fineprint">
            Completed uploads are accepted only after Stripe confirms payment, then saved to the
            studio inbox with email alerts as a backup when configured.
          </p>
        </form>
        )}
      </article>
    </section>
  );
}
