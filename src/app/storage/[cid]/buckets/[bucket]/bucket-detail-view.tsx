"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { toast } from "sonner";
import {
  AuthGuard,
  EmptyState,
  ErrorState,
  formatRelativeTime,
  LoadingState,
  PageShell
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

interface S3Connection {
  id: string;
  name: string;
  endpoint: string;
  flavor: string;
}

interface S3Object {
  key: string;
  size: number;
  lastModified: string | null;
  etag: string | null;
  storageClass: string | null;
}

interface ListObjectsResult {
  bucket: string;
  prefix: string;
  delimiter: string;
  prefixes: string[];
  objects: S3Object[];
  isTruncated: boolean;
  continuationToken: string | null;
  nextContinuationToken: string | null;
  keyCount: number;
}

interface PresignedUrl {
  url: string;
  expiresIn: number;
  method: "GET" | "PUT";
}

const POLICY_TEMPLATES = [
  {
    label: "Private (no public access)",
    build: (_bucket: string) => ""
  },
  {
    label: "Public read (anyone can GET objects)",
    build: (bucket: string) =>
      JSON.stringify(
        {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicRead",
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`]
            }
          ]
        },
        null,
        2
      )
  },
  {
    label: "Public read + list bucket",
    build: (bucket: string) =>
      JSON.stringify(
        {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicRead",
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject", "s3:ListBucket"],
              Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`]
            }
          ]
        },
        null,
        2
      )
  },
  {
    label: "Authenticated read only",
    build: (bucket: string) =>
      JSON.stringify(
        {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "AuthRead",
              Effect: "Allow",
              Principal: { AWS: ["arn:aws:iam::*:root"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`]
            }
          ]
        },
        null,
        2
      )
  }
];

function humanSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function BucketDetailInner({
  user,
  connectionId,
  bucket
}: {
  user: PublicUser;
  connectionId: string;
  bucket: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<"objects" | "permissions">("objects");
  const [conn, setConn] = useState<S3Connection | null>(null);

  // Objects tab
  const [prefix, setPrefix] = useState("");
  const [list, setList] = useState<ListObjectsResult | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Permissions tab
  const [policy, setPolicy] = useState<string>("");
  const [policyDraft, setPolicyDraft] = useState<string>("");
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [templateAnchor, setTemplateAnchor] = useState<HTMLElement | null>(null);

  const loadConn = useCallback(async () => {
    try {
      const c = await apiFetch<S3Connection>(`/api/v1/storage/connections/${connectionId}`);
      setConn(c);
    } catch (err) {
      // surfaced via tabs; harmless if just connection details fail
      console.warn("load connection failed:", err);
    }
  }, [connectionId]);

  // Pass a continuation token to append the next page; omit it to (re)load the
  // first page. Accumulated objects/prefixes live in `list`, while isTruncated /
  // nextContinuationToken always reflect the most recent page.
  const loadObjects = useCallback(
    async (continuationToken?: string) => {
      if (continuationToken) setLoadingMore(true);
      else setListError(null);
      try {
        const params = new URLSearchParams({ prefix });
        if (continuationToken) params.set("continuationToken", continuationToken);
        const res = await apiFetch<ListObjectsResult>(
          `/api/v1/storage/${connectionId}/buckets/${encodeURIComponent(bucket)}/objects?${params}`
        );
        setList((prev) =>
          continuationToken && prev
            ? {
                ...res,
                prefixes: Array.from(new Set([...prev.prefixes, ...res.prefixes])),
                objects: [...prev.objects, ...res.objects]
              }
            : res
        );
      } catch (err) {
        setListError(err instanceof ApiError ? err.message : String(err));
      } finally {
        setLoadingMore(false);
      }
    },
    [connectionId, bucket, prefix]
  );

  const loadPolicy = useCallback(async () => {
    setPolicyError(null);
    try {
      const res = await apiFetch<{ policy: string | null }>(
        `/api/v1/storage/${connectionId}/buckets/${encodeURIComponent(bucket)}/policy`
      );
      const fetched = res.policy ?? "";
      // pretty-print if valid JSON
      let pretty = fetched;
      if (fetched) {
        try {
          pretty = JSON.stringify(JSON.parse(fetched), null, 2);
        } catch {
          // keep raw
        }
      }
      setPolicy(pretty);
      setPolicyDraft(pretty);
      setPolicyLoaded(true);
    } catch (err) {
      setPolicyError(err instanceof ApiError ? err.message : String(err));
    }
  }, [connectionId, bucket]);

  useEffect(() => {
    loadConn();
  }, [loadConn]);

  useEffect(() => {
    if (tab === "objects") void loadObjects();
    if (tab === "permissions" && !policyLoaded) void loadPolicy();
  }, [tab, loadObjects, loadPolicy, policyLoaded]);

  function navigateInto(p: string) {
    setPrefix(p);
  }
  function navigateUp() {
    if (!prefix) return;
    const trimmed = prefix.replace(/\/$/, "");
    const lastSlash = trimmed.lastIndexOf("/");
    setPrefix(lastSlash === -1 ? "" : `${trimmed.slice(0, lastSlash)}/`);
  }

  async function downloadObject(o: S3Object) {
    setBusyKey(o.key);
    try {
      const res = await apiFetch<PresignedUrl>(
        `/api/v1/storage/${connectionId}/buckets/${encodeURIComponent(bucket)}/objects/download-url?key=${encodeURIComponent(o.key)}`
      );
      window.open(res.url, "_blank");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteObject(o: S3Object) {
    if (!confirm(`Delete "${o.key}"? This cannot be undone.`)) return;
    setBusyKey(o.key);
    try {
      await apiFetch(
        `/api/v1/storage/${connectionId}/buckets/${encodeURIComponent(bucket)}/objects?key=${encodeURIComponent(o.key)}`,
        { method: "DELETE" }
      );
      toast.success(`Deleted ${o.key}`);
      await loadObjects();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const key = `${prefix}${file.name}`;
      const res = await apiFetch<PresignedUrl>(
        `/api/v1/storage/${connectionId}/buckets/${encodeURIComponent(bucket)}/objects/upload-url`,
        {
          method: "POST",
          body: JSON.stringify({ key, contentType: file.type || "application/octet-stream" })
        }
      );
      const put = await fetch(res.url, {
        method: "PUT",
        body: file,
        ...(file.type ? { headers: { "Content-Type": file.type } } : {})
      });
      if (!put.ok) throw new Error(`Upload failed: ${put.status} ${put.statusText}`);
      toast.success(`Uploaded ${key}`);
      await loadObjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function savePolicy() {
    setPolicyError(null);
    try {
      JSON.parse(policyDraft);
    } catch (err) {
      setPolicyError(`Not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    setPolicySaving(true);
    try {
      await apiFetch(
        `/api/v1/storage/${connectionId}/buckets/${encodeURIComponent(bucket)}/policy`,
        {
          method: "PUT",
          body: JSON.stringify({ policy: policyDraft })
        }
      );
      toast.success("Policy saved");
      setPolicy(policyDraft);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setPolicyError(msg);
    } finally {
      setPolicySaving(false);
    }
  }

  async function removePolicy() {
    if (!confirm("Remove the bucket policy? Public access will revert to bucket default.")) return;
    setPolicySaving(true);
    try {
      await apiFetch(
        `/api/v1/storage/${connectionId}/buckets/${encodeURIComponent(bucket)}/policy`,
        { method: "DELETE" }
      );
      toast.success("Policy removed");
      setPolicy("");
      setPolicyDraft("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setPolicySaving(false);
    }
  }

  function applyTemplate(label: string) {
    const t = POLICY_TEMPLATES.find((x) => x.label === label);
    if (!t) return;
    setPolicyDraft(t.build(bucket));
    setTemplateAnchor(null);
  }

  return (
    <PageShell
      title={`Bucket · ${bucket}`}
      subtitle={
        conn ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
              {conn.endpoint}
            </Typography>
            <Chip size="small" variant="outlined" label={conn.name} sx={{ fontSize: 10 }} />
          </Stack>
        ) : null
      }
      user={user}
      actions={
        tab === "objects" ? (
          <>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => loadObjects()}
              variant="outlined"
              size="small"
            >
              Refresh
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
            <Button
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              variant="contained"
              size="small"
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </>
        ) : null
      }
    >
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link onClick={() => router.push("/storage")} sx={{ cursor: "pointer" }}>
          Storage
        </Link>
        {conn && (
          <Link
            onClick={() => router.push(`/storage/${connectionId}`)}
            sx={{ cursor: "pointer" }}
          >
            {conn.name}
          </Link>
        )}
        <Typography color="text.primary">{bucket}</Typography>
      </Breadcrumbs>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Objects" value="objects" />
        <Tab label="Permissions" value="permissions" />
      </Tabs>

      {tab === "objects" && (
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <Tooltip title="Up one level">
              <span>
                <IconButton size="small" onClick={navigateUp} disabled={!prefix}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Typography
              variant="body2"
              sx={{ fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {bucket}/{prefix}
            </Typography>
          </Stack>

          {listError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setListError(null)}>
              {listError}
            </Alert>
          )}

          <Paper variant="outlined">
            {list === null ? (
              <Box sx={{ p: 4 }}>
                <LoadingState />
              </Box>
            ) : list.prefixes.length === 0 && list.objects.length === 0 ? (
              <EmptyState
                title={prefix ? `No objects under ${prefix}` : "Empty bucket"}
                message="Upload a file to get started."
              />
            ) : (
              <Box>
                {list.prefixes.map((p) => (
                  <Box
                    key={p}
                    onClick={() => navigateInto(p)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 1.5,
                      borderBottom: 1,
                      borderColor: "divider",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" }
                    }}
                  >
                    <FolderIcon color="action" />
                    <Typography variant="body2" sx={{ fontFamily: "monospace", flex: 1 }}>
                      {p.replace(prefix, "")}
                    </Typography>
                  </Box>
                ))}
                {list.objects
                  .filter((o) => o.key !== prefix)
                  .map((o) => {
                    const display = o.key.replace(prefix, "");
                    const busy = busyKey === o.key;
                    return (
                      <Box
                        key={o.key}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1.5,
                          borderBottom: 1,
                          borderColor: "divider"
                        }}
                      >
                        <InsertDriveFileIcon color="action" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}
                          >
                            {display}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {humanSize(o.size)}
                            {o.lastModified && ` · ${formatRelativeTime(o.lastModified)}`}
                          </Typography>
                        </Box>
                        <Tooltip title="Download">
                          <span>
                            <IconButton size="small" onClick={() => downloadObject(o)} disabled={busy}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => deleteObject(o)}
                              disabled={busy}
                              color="error"
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    );
                  })}
              </Box>
            )}
          </Paper>

          {list?.isTruncated && (
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                size="small"
                disabled={loadingMore || !list.nextContinuationToken}
                onClick={() => loadObjects(list.nextContinuationToken ?? undefined)}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
              <Typography variant="caption" color="text.secondary">
                {list.objects.length} loaded · more available
              </Typography>
            </Stack>
          )}
        </Box>
      )}

      {tab === "permissions" && (
        <Box>
          {!policyLoaded && !policyError && <LoadingState />}
          {policyError && (
            <ErrorState
              title="Cannot load policy"
              message={policyError}
              onRetry={() => {
                setPolicyLoaded(false);
                void loadPolicy();
              }}
            />
          )}
          {policyLoaded && (
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  Bucket policy is a JSON document that controls who can do what.
                  Pick a template or write your own.
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(e) => setTemplateAnchor(e.currentTarget)}
                >
                  Template
                </Button>
                <Menu
                  anchorEl={templateAnchor}
                  open={Boolean(templateAnchor)}
                  onClose={() => setTemplateAnchor(null)}
                >
                  {POLICY_TEMPLATES.map((t) => (
                    <MenuItem key={t.label} onClick={() => applyTemplate(t.label)}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Menu>
              </Stack>

              <TextField
                multiline
                minRows={16}
                value={policyDraft}
                onChange={(e) => setPolicyDraft(e.target.value)}
                placeholder='// no policy set — bucket inherits its default ACL'
                inputProps={{
                  style: {
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 12.5
                  }
                }}
              />

              {policyError && <Alert severity="error">{policyError}</Alert>}

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button onClick={() => setPolicyDraft(policy)} disabled={policySaving}>
                  Reset
                </Button>
                {policy && (
                  <Button color="error" onClick={removePolicy} disabled={policySaving}>
                    Remove policy
                  </Button>
                )}
                <Button
                  variant="contained"
                  onClick={savePolicy}
                  disabled={policySaving || policyDraft === policy}
                >
                  {policySaving ? "Saving…" : "Save policy"}
                </Button>
              </Stack>
            </Stack>
          )}
        </Box>
      )}
    </PageShell>
  );
}

export default function BucketDetailView({
  connectionId,
  bucket
}: {
  connectionId: string;
  bucket: string;
}) {
  return (
    <AuthGuard>
      {(user) => <BucketDetailInner user={user} connectionId={connectionId} bucket={bucket} />}
    </AuthGuard>
  );
}
