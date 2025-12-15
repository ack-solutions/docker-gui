"use client";

import { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { EmailSidebar } from "@/client/features/email/components/email-sidebar";
import { EmailList } from "@/client/features/email/components/email-list";
import { EmailDetail } from "@/client/features/email/components/email-detail";

const EmailPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const emailIdFromRoute = searchParams.get("emailId");

  // Sync route with state
  const handleSelectEmail = (emailId: string) => {
    router.push(`/email?emailId=${emailId}&folder=${selectedFolder}`);
  };

  // Update folder from route or default
  useEffect(() => {
    const folderFromRoute = searchParams.get("folder");
    if (folderFromRoute) {
      setSelectedFolder(folderFromRoute);
    }
  }, [searchParams]);

  return (
    <Box sx={{ 
      display: "flex", 
      height: "100%",
      width: "100%",
      overflow: "hidden",
      margin: 0,
      padding: 0
    }}>
      <EmailSidebar
        onFolderSelect={(folderId) => {
          setSelectedFolder(folderId);
          // Clear email selection when folder changes
          if (emailIdFromRoute) {
            router.push(`/email?folder=${folderId}`);
          }
        }}
        selectedFolderId={selectedFolder}
      />
      <EmailList
        folderId={selectedFolder}
        onSelectEmail={handleSelectEmail}
        selectedEmailId={emailIdFromRoute}
      />
      <EmailDetail emailId={emailIdFromRoute} />
    </Box>
  );
};

export default EmailPage;
