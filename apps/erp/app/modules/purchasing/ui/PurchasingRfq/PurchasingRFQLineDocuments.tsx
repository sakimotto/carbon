import { useCarbon } from "@carbon/auth";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  File,
  HStack,
  IconButton,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  toast
} from "@carbon/react";
import { convertKbToString } from "@carbon/utils";
import type { FileObject } from "@supabase/storage-js";
import type { ChangeEvent } from "react";
import { useCallback } from "react";
import { LuEllipsisVertical, LuUpload } from "react-icons/lu";
import { useRevalidator } from "react-router";
import { DocumentPreview, FileDropzone } from "~/components";
import DocumentIcon from "~/components/DocumentIcon";
import { usePermissions, useUser } from "~/hooks";
import { getDocumentType } from "~/modules/shared";
import { path } from "~/utils/path";
import { stripSpecialCharacters } from "~/utils/string";

const usePurchasingRFQLineDocuments = ({
  id,
  lineId,
  itemId
}: {
  id: string;
  lineId: string;
  itemId?: string | null;
}) => {
  const permissions = usePermissions();
  const revalidator = useRevalidator();
  const { carbon } = useCarbon();
  const { company } = useUser();

  const canDelete = permissions.can("delete", "purchasing");
  const canUpdate = permissions.can("update", "purchasing");

  const getPath = useCallback(
    (file: { name: string }) => {
      return `${company.id}/purchasing-rfq/${lineId}/${stripSpecialCharacters(
        file.name
      )}`;
    },
    [company.id, lineId]
  );

  const deleteFile = useCallback(
    async (file: FileObject) => {
      const fileDelete = await carbon?.storage
        .from("private")
        .remove([getPath(file)]);

      if (!fileDelete || fileDelete.error) {
        toast.error(fileDelete?.error?.message || "Error deleting file");
        return;
      }

      toast.success(`${file.name} deleted successfully`);
      revalidator.revalidate();
    },
    [getPath, carbon?.storage, revalidator]
  );

  const download = useCallback(
    async (file: FileObject) => {
      const url = path.to.file.previewFile(`private/${getPath(file)}`);
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.href = blobUrl;
        a.download = file.name;
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      } catch (error) {
        toast.error("Error downloading file");
        console.error(error);
      }
    },
    [getPath]
  );

  const upload = useCallback(
    async (files: File[]) => {
      if (!carbon) {
        toast.error("Carbon client not available");
        return;
      }

      for (const file of files) {
        const fileName = getPath(file);

        const fileUpload = await carbon.storage
          .from("private")
          .upload(fileName, file, {
            cacheControl: `${12 * 60 * 60}`,
            upsert: true
          });

        if (fileUpload.error) {
          toast.error(`Failed to upload file: ${file.name}`);
        }
      }
      revalidator.revalidate();
    },
    [getPath, carbon, revalidator]
  );

  return {
    canDelete,
    canUpdate,
    deleteFile,
    download,
    getPath,
    upload
  };
};

type PurchasingRFQLineDocumentsProps = {
  files: FileObject[];
  id: string;
  lineId: string;
  itemId?: string | null;
  type: string;
};

const PurchasingRFQLineDocuments = ({
  files,
  id,
  lineId,
  itemId,
  type
}: PurchasingRFQLineDocumentsProps) => {
  const { canDelete, download, deleteFile, getPath, upload } =
    usePurchasingRFQLineDocuments({
      id,
      lineId,
      itemId
    });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      upload(acceptedFiles);
    },
    [upload]
  );

  return (
    <>
      <Card className="flex-grow">
        <HStack className="justify-between items-start">
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>RFQ line documents</CardDescription>
          </CardHeader>
          <CardAction>
            <PurchasingRFQLineDocumentForm
              id={id}
              lineId={lineId}
              itemId={itemId}
            />
          </CardAction>
        </HStack>
        <CardContent>
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Size</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {files.map((file) => {
                const docType = getDocumentType(file.name);
                return (
                  <Tr key={file.id}>
                    <Td>
                      <HStack>
                        <DocumentIcon type={docType} />
                        <span
                          className="font-medium cursor-pointer"
                          onClick={() => {
                            if (["PDF", "Image"].includes(docType)) {
                              window.open(
                                path.to.file.previewFile(
                                  `private/${getPath(file)}`
                                ),
                                "_blank"
                              );
                            } else {
                              download(file);
                            }
                          }}
                        >
                          {["PDF", "Image"].includes(docType) ? (
                            <DocumentPreview
                              bucket="private"
                              pathToFile={getPath(file)}
                              type={docType as "PDF" | "Image"}
                            >
                              {file.name}
                            </DocumentPreview>
                          ) : (
                            file.name
                          )}
                        </span>
                      </HStack>
                    </Td>
                    <Td>
                      {convertKbToString(
                        Math.floor((file.metadata?.size ?? 0) / 1024)
                      )}
                    </Td>
                    <Td>
                      <div className="flex justify-end w-full">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton
                              aria-label="More"
                              icon={<LuEllipsisVertical />}
                              variant="secondary"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => download(file)}>
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              destructive
                              disabled={!canDelete}
                              onClick={() => deleteFile(file)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
              {files.length === 0 && (
                <Tr>
                  <Td
                    colSpan={3}
                    className="py-8 text-muted-foreground text-center"
                  >
                    No files
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
          <FileDropzone onDrop={onDrop} />
        </CardContent>
      </Card>
    </>
  );
};

export default PurchasingRFQLineDocuments;

type PurchasingRFQLineDocumentFormProps = {
  id: string;
  lineId: string;
  itemId?: string | null;
};

const PurchasingRFQLineDocumentForm = ({
  id,
  lineId,
  itemId
}: PurchasingRFQLineDocumentFormProps) => {
  const permissions = usePermissions();
  const { upload } = usePurchasingRFQLineDocuments({ id, lineId, itemId });

  const uploadFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      upload(Array.from(e.target.files));
    }
  };

  return (
    <File
      isDisabled={!permissions.can("update", "purchasing")}
      leftIcon={<LuUpload />}
      onChange={uploadFiles}
      multiple
    >
      New
    </File>
  );
};
