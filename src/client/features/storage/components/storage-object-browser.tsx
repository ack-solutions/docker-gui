"use client";

import { useState, useMemo, useRef } from "react";
import {
    Alert,
    Box,
    Breadcrumbs,
    Button,
    Card,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    LinearProgress,
    Link,
    Menu,
    MenuItem,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import HomeIcon from "@mui/icons-material/Home";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DriveFolderUploadIcon from "@mui/icons-material/DriveFolderUpload";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InfoIcon from "@mui/icons-material/Info";
import ShareIcon from "@mui/icons-material/Share";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/client/components/common/confirmation-dialog-provider";
import FileInfoDialog from "./file-info-dialog";
import ShareDialog from "./share-dialog";
import BulkActionsToolbar from "./bulk-actions-toolbar";
import { useSelection } from "../hooks/use-selection";

interface ObjectInfo {
    name: string;
    size: number;
    etag?: string;
    lastModified?: string;
    prefix?: string;
    isDir?: boolean;
}

interface StorageObjectBrowserProps {
    bucket: string;
    onBack?: () => void;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString?: string): string {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
}

function getFileIcon(name: string, isDir?: boolean) {
    if (isDir) {
        return <FolderIcon color="primary" />;
    }

    const ext = name.split(".").pop()?.toLowerCase();
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico"];
    const docExts = ["pdf", "doc", "docx", "txt", "md"];
    const codeExts = ["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "go", "rs"];
    const archiveExts = ["zip", "tar", "gz", "rar", "7z"];

    let color: "action" | "primary" | "secondary" | "success" | "warning" = "action";
    if (imageExts.includes(ext || "")) color = "primary";
    else if (docExts.includes(ext || "")) color = "secondary";
    else if (codeExts.includes(ext || "")) color = "success";
    else if (archiveExts.includes(ext || "")) color = "warning";

    return <InsertDriveFileIcon color={color} />;
}

export default function StorageObjectBrowser({ bucket, onBack }: StorageObjectBrowserProps) {
    const queryClient = useQueryClient();
    const { confirm } = useConfirmationDialog();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const [currentPrefix, setCurrentPrefix] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [folderError, setFolderError] = useState("");

    // File info dialog state
    const [fileInfoOpen, setFileInfoOpen] = useState(false);
    const [selectedFileInfo, setSelectedFileInfo] = useState<string | null>(null);

    // Share dialog state
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [selectedShareFile, setSelectedShareFile] = useState<string | null>(null);

    // Upload menu anchor
    const [uploadMenuAnchor, setUploadMenuAnchor] = useState<null | HTMLElement>(null);

    // Selection state
    const selection = useSelection();

    // Drag and drop state
    const [draggedItem, setDraggedItem] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    // Search and sort state (removed fileType filter)
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>("name");
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("asc");

    const { data: objects, isLoading, refetch } = useQuery<ObjectInfo[]>({
        queryKey: ["storage-objects", bucket, currentPrefix],
        queryFn: async () => {
            const params = new URLSearchParams({
                bucket,
                prefix: currentPrefix,
                recursive: "false",
            });
            const res = await axios.get(`/api/storage/objects?${params}`);
            return res.data;
        },
        enabled: !!bucket,
    });

    const createFolderMutation = useMutation({
        mutationFn: async (name: string) => {
            const path = currentPrefix + name;
            await axios.post("/api/storage/folders", { bucket, path });
        },
        onSuccess: () => {
            toast.success("Folder created");
            queryClient.invalidateQueries({ queryKey: ["storage-objects", bucket] });
            setIsFolderDialogOpen(false);
            setNewFolderName("");
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to create folder");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async ({ objectName }: { objectName: string }) => {
            await axios.post("/api/storage/objects", {
                action: "delete",
                bucket,
                objectName: currentPrefix + objectName,
            });
        },
        onSuccess: () => {
            toast.success("Deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["storage-objects", bucket] });
            selection.clearSelection();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to delete");
        },
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: async (objectNames: string[]) => {
            const fullPaths = objectNames.map((name) => currentPrefix + name);
            await axios.post("/api/storage/bulk", {
                action: "delete",
                bucket,
                objectNames: fullPaths,
            });
        },
        onSuccess: () => {
            toast.success("Bulk delete successful");
            queryClient.invalidateQueries({ queryKey: ["storage-objects", bucket] });
            selection.clearSelection();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Bulk delete failed");
        },
    });

    const moveMutation = useMutation({
        mutationFn: async ({
            sourcePath,
            destinationPath,
        }: {
            sourcePath: string;
            destinationPath: string;
        }) => {
            await axios.post("/api/storage/move", {
                action: "move",
                bucket,
                sourcePath,
                destinationPath,
            });
        },
        onSuccess: () => {
            toast.success("Moved successfully");
            queryClient.invalidateQueries({ queryKey: ["storage-objects", bucket] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to move");
        },
    });

    // Parse current path into breadcrumb segments
    const pathSegments = useMemo(() => {
        if (!currentPrefix) return [];
        return currentPrefix.split("/").filter(Boolean);
    }, [currentPrefix]);

    // Process objects to show folders and files
    const processedObjects = useMemo(() => {
        if (!objects) return { folders: [], files: [] };

        const folders: ObjectInfo[] = [];
        const files: ObjectInfo[] = [];

        objects.forEach((obj) => {
            if (obj.prefix || obj.name.endsWith("/")) {
                const folderName = obj.prefix || obj.name;
                const name = folderName.replace(currentPrefix, "").replace(/\/$/, "");
                if (name) {
                    folders.push({ ...obj, name, isDir: true });
                }
            } else {
                const name = obj.name.replace(currentPrefix, "");
                if (name && !name.includes("/")) {
                    files.push({ ...obj, name, isDir: false });
                }
            }
        });

        return { folders, files };
    }, [objects, currentPrefix]);

    // Apply search and filter
    // Simple filtering and sorting (removed fileType filter)
    const filteredObjects = useMemo(() => {
        let items = [...processedObjects.folders, ...processedObjects.files];

        // Apply search filter
        if (searchQuery) {
            items = items.filter((obj) =>
                obj.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Apply sorting
        items.sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortBy === 'size') {
                comparison = (a.size || 0) - (b.size || 0);
            } else if (sortBy === 'date') {
                const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
                const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
                comparison = dateA - dateB;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return items;
    }, [processedObjects, searchQuery, sortBy, sortOrder]);

    const filteredFolders = filteredObjects.filter((obj) => obj.isDir);
    const filteredFiles = filteredObjects.filter((obj) => !obj.isDir);

    const handleNavigateToFolder = (folderName: string) => {
        setCurrentPrefix(currentPrefix + folderName + "/");
        selection.clearSelection();
    };

    const handleNavigateUp = () => {
        const segments = currentPrefix.split("/").filter(Boolean);
        segments.pop();
        setCurrentPrefix(segments.length > 0 ? segments.join("/") + "/" : "");
        selection.clearSelection();
    };

    const handleBreadcrumbClick = (index: number) => {
        if (index === -1) {
            setCurrentPrefix("");
        } else {
            const newPrefix = pathSegments.slice(0, index + 1).join("/") + "/";
            setCurrentPrefix(newPrefix);
        }
        selection.clearSelection();
    };

    const handleCopyPath = (objectName: string) => {
        const fullPath = `s3://${bucket}/${currentPrefix}${objectName}`;
        navigator.clipboard.writeText(fullPath);
        toast.success("Path copied to clipboard");
    };

    const handleDownload = async (fileName: string) => {
        try {
            const res = await axios.post("/api/storage/objects", {
                action: "download",
                bucket,
                objectName: currentPrefix + fileName,
            });
            window.open(res.data.url, "_blank");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to get download link");
        }
    };

    const handleDelete = (item: ObjectInfo) => {
        const itemPath = item.isDir ? item.name + "/" : item.name;
        confirm({
            title: `Delete ${item.isDir ? "Folder" : "File"}`,
            message: (
                <>
                    Are you sure you want to delete <strong>{item.name}</strong>?
                    {item.isDir && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            Note: Only empty folders can be deleted.
                        </Alert>
                    )}
                </>
            ),
            confirmLabel: "Delete",
            tone: "danger",
        }).then((confirmed) => {
            if (confirmed) {
                deleteMutation.mutate({ objectName: itemPath });
            }
        });
    };

    const handleBulkDelete = () => {
        const count = selection.selectedCount;
        confirm({
            title: "Delete Selected Items",
            message: (
                <>
                    Are you sure you want to delete <strong>{count}</strong> selected item(s)?
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        This action cannot be undone.
                    </Alert>
                </>
            ),
            confirmLabel: "Delete All",
            tone: "danger",
        }).then((confirmed) => {
            if (confirmed) {
                bulkDeleteMutation.mutate(Array.from(selection.selectedItems));
            }
        });
    };

    const handleBulkDownload = () => {
        toast.info("Downloading selected files individually...");
        Array.from(selection.selectedItems).forEach((fileName) => {
            handleDownload(fileName);
        });
    };

    const handleShowInfo = (fileName: string) => {
        setSelectedFileInfo(fileName);
        setFileInfoOpen(true);
    };

    const handleShowShare = (fileName: string) => {
        setSelectedShareFile(fileName);
        setShareDialogOpen(true);
    };

    const handleUploadMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setUploadMenuAnchor(event.currentTarget);
    };

    const handleUploadMenuClose = () => {
        setUploadMenuAnchor(null);
    };

    const handleUploadClick = () => {
        handleUploadMenuClose();
        fileInputRef.current?.click();
    };

    const handleFolderUploadClick = () => {
        handleUploadMenuClose();
        folderInputRef.current?.click();
    };

    const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append("file", file);
                formData.append("bucket", bucket);
                const relativePath = (file as any).webkitRelativePath || file.name;
                const folderPath = relativePath.substring(0, relativePath.lastIndexOf("/") + 1);
                formData.append("prefix", currentPrefix + folderPath);

                await axios.post("/api/storage/upload", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    onUploadProgress: (progressEvent) => {
                        const progress = progressEvent.total
                            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                            : 0;
                        setUploadProgress((i / files.length) * 100 + progress / files.length);
                    },
                });
            }
            toast.success(`Uploaded ${files.length} file(s) from folder`);
            queryClient.invalidateQueries({ queryKey: ["storage-objects", bucket] });
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Folder upload failed");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            if (folderInputRef.current) {
                folderInputRef.current.value = "";
            }
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append("file", file);
                formData.append("bucket", bucket);
                formData.append("prefix", currentPrefix);

                await axios.post("/api/storage/upload", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    onUploadProgress: (progressEvent) => {
                        const progress = progressEvent.total
                            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                            : 0;
                        setUploadProgress((i / files.length) * 100 + progress / files.length);
                    },
                });
            }
            toast.success(`Uploaded ${files.length} file(s)`);
            queryClient.invalidateQueries({ queryKey: ["storage-objects", bucket] });
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Upload failed");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) {
            setFolderError("Folder name is required");
            return;
        }
        if (/[<>:"|?*\\/]/.test(newFolderName)) {
            setFolderError("Invalid characters in folder name");
            return;
        }
        createFolderMutation.mutate(newFolderName.trim());
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, itemName: string, isDir: boolean) => {
        if (isDir) return; // Don't allow dragging folders for now
        setDraggedItem(itemName);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, folderName: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(folderName);
    };

    const handleDragLeave = () => {
        setDropTarget(null);
    };

    const handleDrop = async (e: React.DragEvent, folderName: string) => {
        e.preventDefault();
        setDropTarget(null);

        if (!draggedItem) return;

        const sourcePath = currentPrefix + draggedItem;
        const destinationPath = currentPrefix + folderName + "/" + draggedItem;

        confirm({
            title: "Move File",
            message: (
                <>
                    Move <strong>{draggedItem}</strong> to <strong>{folderName}</strong>?
                </>
            ),
            confirmLabel: "Move",
        }).then((confirmed) => {
            if (confirmed) {
                moveMutation.mutate({ sourcePath, destinationPath });
            }
        });

        setDraggedItem(null);
    };

    const handleSelectAll = () => {
        const allItems = filteredObjects.map((item) => item.name);
        if (selection.selectedCount === allItems.length) {
            selection.clearSelection();
        } else {
            selection.selectAll(allItems);
        }
    };

    // Handle column sorting
    const handleSort = (column: 'name' | 'size' | 'date') => {
        if (sortBy === column) {
            // Toggle sort order if clicking the same column
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new column and default to ascending
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const allSelectableItems = filteredObjects.map((item) => item.name);
    const isAllSelected =
        allSelectableItems.length > 0 && selection.selectedCount === allSelectableItems.length;
    const isSomeSelected = selection.selectedCount > 0 && !isAllSelected;

    return (
        <Box>
            {/* Hidden file inputs */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileSelect}
                multiple
            />
            <input
                type="file"
                ref={folderInputRef}
                style={{ display: "none" }}
                onChange={handleFolderSelect}
                multiple
                {...({ webkitdirectory: "", directory: "" } as any)}
            />

            {/* Header with Back button and Actions */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    {onBack && (
                        <Button size="small" startIcon={<ArrowBackIcon />} onClick={onBack}>
                            Back to Buckets
                        </Button>
                    )}
                </Stack>
                <Stack direction="row" spacing={1}>
                    {/* Compact Search */}
                    <TextField
                        size="small"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        sx={{ width: 200 }}
                    />
                    <Button
                        size="small"
                        startIcon={<CreateNewFolderIcon />}
                        onClick={() => setIsFolderDialogOpen(true)}
                    >
                        New Folder
                    </Button>
                    <Button
                        size="small"
                        startIcon={<UploadFileIcon />}
                        onClick={handleUploadMenuOpen}
                    >
                        Upload
                    </Button>
                    <Menu
                        anchorEl={uploadMenuAnchor}
                        open={Boolean(uploadMenuAnchor)}
                        onClose={handleUploadMenuClose}
                    >
                        <MenuItem onClick={handleUploadClick}>
                            <UploadFileIcon fontSize="small" sx={{ mr: 1 }} />
                            Upload Files
                        </MenuItem>
                        <MenuItem onClick={handleFolderUploadClick}>
                            <DriveFolderUploadIcon fontSize="small" sx={{ mr: 1 }} />
                            Upload Folder
                        </MenuItem>
                    </Menu>
                    <Button
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={() => refetch()}
                    >
                        Refresh
                    </Button>
                </Stack>
            </Stack>

            {/* Upload progress */}
            {isUploading && (
                <Box sx={{ mb: 2 }}>
                    <LinearProgress variant="determinate" value={uploadProgress} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        Uploading... {Math.round(uploadProgress)}%
                    </Typography>
                </Box>
            )}

            {/* Breadcrumbs - Outside Card */}
            <Box sx={{ mb: 2 }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="folder path">
                    <Link
                        component="button"
                        variant="body2"
                        underline="hover"
                        onClick={() => handleBreadcrumbClick(-1)}
                        sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}
                    >
                        <HomeIcon fontSize="small" />
                        {bucket}
                    </Link>
                    {pathSegments.map((segment, index) => {
                        const isLast = index === pathSegments.length - 1;
                        return isLast ? (
                            <Typography key={index} variant="body2" color="text.primary">
                                {segment}
                            </Typography>
                        ) : (
                            <Link
                                key={index}
                                component="button"
                                variant="body2"
                                underline="hover"
                                onClick={() => handleBreadcrumbClick(index)}
                                sx={{ cursor: "pointer" }}
                            >
                                {segment}
                            </Link>
                        );
                    })}
                </Breadcrumbs>
            </Box>

            {/* Loading */}
            {isLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Empty state */}
            {!isLoading && filteredObjects.length === 0 && (
                <Alert severity="info" icon={<FolderIcon />}>
                    {searchQuery
                        ? "No files or folders match your search."
                        : currentPrefix
                            ? "This folder is empty. Upload files or create subfolders."
                            : "This bucket is empty. Upload files or create folders to get started."}
                </Alert>
            )}

            {/* Objects table */}
            {!isLoading && filteredObjects.length > 0 && (
                <Card variant="outlined">
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={isAllSelected}
                                            indeterminate={isSomeSelected}
                                            onChange={handleSelectAll}
                                        />
                                    </TableCell>
                                    <TableCell
                                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('name')}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                            <span>Name</span>
                                            {sortBy === 'name' && (
                                                <Typography variant="caption" color="primary">
                                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell
                                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('size')}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                            <span>Size</span>
                                            {sortBy === 'size' && (
                                                <Typography variant="caption" color="primary">
                                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell
                                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('date')}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                            <span>Last Modified</span>
                                            {sortBy === 'date' && (
                                                <Typography variant="caption" color="primary">
                                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {/* Up folder when in subdirectory */}
                                {currentPrefix && (
                                    <TableRow hover sx={{ cursor: "pointer" }} onClick={handleNavigateUp}>
                                        <TableCell padding="checkbox" />
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <FolderIcon color="action" />
                                                <Typography variant="body2">..</Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>—</TableCell>
                                        <TableCell>—</TableCell>
                                        <TableCell />
                                    </TableRow>
                                )}

                                {/* Folders first */}
                                {filteredFolders.map((folder) => (
                                    <TableRow
                                        key={folder.name}
                                        hover
                                        sx={{
                                            cursor: "pointer",
                                            bgcolor:
                                                dropTarget === folder.name
                                                    ? "action.hover"
                                                    : undefined,
                                        }}
                                        onDragOver={(e) => handleDragOver(e, folder.name)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, folder.name)}
                                    >
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selection.isSelected(folder.name)}
                                                onChange={() => selection.toggleSelection(folder.name)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </TableCell>
                                        <TableCell onClick={() => handleNavigateToFolder(folder.name)}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <FolderIcon color="primary" />
                                                <Typography variant="body2" fontWeight={500}>
                                                    {folder.name}/
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>—</TableCell>
                                        <TableCell>—</TableCell>
                                        <TableCell align="right">
                                            <Stack
                                                direction="row"
                                                spacing={0.5}
                                                justifyContent="flex-end"
                                            >
                                                <Tooltip title="Copy S3 path">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyPath(folder.name + "/");
                                                        }}
                                                    >
                                                        <ContentCopyIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete folder">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(folder);
                                                        }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {/* Files */}
                                {filteredFiles.map((file) => (
                                    <TableRow
                                        key={file.name}
                                        hover
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, file.name, false)}
                                        onClick={() => handleShowInfo(file.name)}
                                        sx={{
                                            opacity: draggedItem === file.name ? 0.5 : 1,
                                            bgcolor: selection.isSelected(file.name)
                                                ? "action.selected"
                                                : undefined,
                                            cursor: "pointer",
                                        }}
                                    >
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selection.isSelected(file.name)}
                                                onChange={() => selection.toggleSelection(file.name)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                {getFileIcon(file.name, false)}
                                                <Typography variant="body2">{file.name}</Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatBytes(file.size)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatDate(file.lastModified)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack
                                                direction="row"
                                                spacing={0.5}
                                                justifyContent="flex-end"
                                            >
                                                <Tooltip title="File info">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleShowInfo(file.name);
                                                        }}
                                                    >
                                                        <InfoIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Share">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleShowShare(file.name);
                                                        }}
                                                    >
                                                        <ShareIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Download">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownload(file.name);
                                                        }}
                                                    >
                                                        <DownloadIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Copy S3 path">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyPath(file.name);
                                                        }}
                                                    >
                                                        <ContentCopyIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete file">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(file);
                                                        }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Summary footer */}
                    <Box sx={{ p: 1.5, borderTop: 1, borderColor: "divider", bgcolor: "action.hover" }}>
                        <Typography variant="caption" color="text.secondary">
                            {filteredFolders.length} folder(s), {filteredFiles.length} file(s)
                            {filteredFiles.length > 0 && (
                                <>
                                    {" "}
                                    • Total size:{" "}
                                    {formatBytes(
                                        filteredFiles.reduce((sum, f) => sum + f.size, 0)
                                    )}
                                </>
                            )}
                            {searchQuery && (
                                <>
                                    {" "}
                                    • Filtered from {processedObjects.folders.length + processedObjects.files.length} total
                                </>
                            )}
                        </Typography>
                    </Box>
                </Card>
            )}

            {/* Bulk Actions Toolbar */}
            {selection.hasSelection && (
                <BulkActionsToolbar
                    selectedCount={selection.selectedCount}
                    onDelete={handleBulkDelete}
                    onDownload={handleBulkDownload}
                    onClear={selection.clearSelection}
                    isProcessing={bulkDeleteMutation.isPending}
                />
            )}

            {/* Create Folder Dialog */}
            <Dialog
                open={isFolderDialogOpen}
                onClose={() => setIsFolderDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Folder Name"
                            value={newFolderName}
                            onChange={(e) => {
                                setNewFolderName(e.target.value);
                                setFolderError("");
                            }}
                            error={!!folderError}
                            helperText={folderError || `Will be created at: ${currentPrefix || "/"}`}
                            placeholder="my-folder"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsFolderDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateFolder}
                        disabled={createFolderMutation.isPending || !newFolderName.trim()}
                    >
                        {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* File Info Dialog */}
            {selectedFileInfo && (
                <FileInfoDialog
                    open={fileInfoOpen}
                    onClose={() => {
                        setFileInfoOpen(false);
                        setSelectedFileInfo(null);
                    }}
                    bucket={bucket}
                    objectName={selectedFileInfo}
                    prefix={currentPrefix}
                />
            )}

            {/* Share Dialog */}
            {selectedShareFile && (
                <ShareDialog
                    open={shareDialogOpen}
                    onClose={() => {
                        setShareDialogOpen(false);
                        setSelectedShareFile(null);
                    }}
                    bucket={bucket}
                    objectName={selectedShareFile}
                    prefix={currentPrefix}
                />
            )}
        </Box>
    );
}
