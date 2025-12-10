import { ValidatedForm } from "@carbon/form";
import {
  Button,
  Copy,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  VStack,
} from "@carbon/react";
import type { FetcherWithComponents } from "@remix-run/react";
import { useState } from "react";
import { SelectControlled, SupplierContact } from "~/components/Form";
import { useIntegrations } from "~/hooks/useIntegrations";
import { supplierQuoteFinalizeValidator } from "../../purchasing.models";
import type { SupplierQuote } from "../../types";
import { path } from "~/utils/path";

type SupplierQuoteSendModalProps = {
  onClose: () => void;
  quote?: SupplierQuote;
  fetcher: FetcherWithComponents<{}>;
  externalLinkId?: string;
};

const SupplierQuoteSendModal = ({
  quote,
  onClose,
  fetcher,
  externalLinkId,
}: SupplierQuoteSendModalProps) => {
  const integrations = useIntegrations();
  const canEmail = integrations.has("resend");

  const [notificationType, setNotificationType] = useState(
    canEmail ? "Email" : "None"
  );

  const digitalQuoteUrl =
    externalLinkId && typeof window !== "undefined"
      ? `${window.location.origin}${path.to.externalSupplierQuote(
          externalLinkId
        )}`
      : "";

  if (!canEmail) {
    return (
      <Modal
        open
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Send {quote?.supplierQuoteId}</ModalTitle>
            <ModalDescription>
              Copy this link to share the quote with a supplier
            </ModalDescription>
          </ModalHeader>
          <ModalBody>
            <InputGroup>
              <Input value={digitalQuoteUrl} isReadOnly />
              <InputRightElement>
                <Copy text={digitalQuoteUrl} />
              </InputRightElement>
            </InputGroup>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <ModalContent>
        <ValidatedForm
          method="post"
          validator={supplierQuoteFinalizeValidator}
          action={path.to.supplierQuoteSend(quote?.id || "")}
          onSubmit={onClose}
          defaultValues={{
            notification: notificationType as "Email" | "None",
            supplierContact: quote?.supplierContactId ?? undefined,
          }}
          fetcher={fetcher}
        >
          <ModalHeader>
            <ModalTitle>Send {quote?.supplierQuoteId}</ModalTitle>
            <ModalDescription>
              Send the supplier quote to the supplier via email.
            </ModalDescription>
          </ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              {canEmail && (
                <SelectControlled
                  label="Send Via"
                  name="notification"
                  options={[
                    {
                      label: "None",
                      value: "None",
                    },
                    {
                      label: "Email",
                      value: "Email",
                    },
                  ]}
                  value={notificationType}
                  onChange={(t) => {
                    if (t) setNotificationType(t.value);
                  }}
                />
              )}
              {notificationType === "Email" && (
                <SupplierContact
                  name="supplierContact"
                  supplier={quote?.supplierId ?? undefined}
                />
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Send</Button>
          </ModalFooter>
        </ValidatedForm>
      </ModalContent>
    </Modal>
  );
};

export default SupplierQuoteSendModal;
