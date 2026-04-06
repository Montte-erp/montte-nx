// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
   render,
   screen,
   fireEvent,
   waitFor,
   cleanup,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();

let mockCreateShouldFail = false;
let mockUpdateShouldFail = false;

vi.mock("@/integrations/orpc/client", () => ({
   orpc: {
      tags: {
         create: {
            mutationOptions: ({
               onSuccess,
               onError,
            }: {
               onSuccess?: () => void;
               onError?: (e: Error) => void;
            }) => ({
               mutationKey: ["tags.create"],
               mutationFn: async (input: unknown) => {
                  mockCreateMutate(input);
                  if (mockCreateShouldFail) throw new Error("Erro de servidor");
                  return input;
               },
               onSuccess,
               onError,
            }),
         },
         update: {
            mutationOptions: ({
               onSuccess,
               onError,
            }: {
               onSuccess?: () => void;
               onError?: (e: Error) => void;
            }) => ({
               mutationKey: ["tags.update"],
               mutationFn: async (input: unknown) => {
                  mockUpdateMutate(input);
                  if (mockUpdateShouldFail) throw new Error("Erro de servidor");
                  return input;
               },
               onSuccess,
               onError,
            }),
         },
      },
   },
}));

vi.mock("sonner", () => ({
   toast: {
      success: vi.fn(),
      error: vi.fn(),
   },
}));

vi.mock("@packages/ui/components/credenza", () => ({
   CredenzaHeader: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="credenza-header">{children}</div>
   ),
   CredenzaTitle: ({ children }: { children: React.ReactNode }) => (
      <h2>{children}</h2>
   ),
   CredenzaDescription: ({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
   ),
   CredenzaBody: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="credenza-body">{children}</div>
   ),
   CredenzaFooter: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="credenza-footer">{children}</div>
   ),
}));

vi.mock("@packages/ui/components/color-picker", () => ({
   ColorPicker: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   ColorPickerAlpha: () => <div />,
   ColorPickerEyeDropper: () => <div />,
   ColorPickerFormat: () => <div />,
   ColorPickerHue: () => <div />,
   ColorPickerOutput: () => <div />,
   ColorPickerSelection: () => <div />,
}));

vi.mock("@packages/ui/components/popover", () => ({
   Popover: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   PopoverContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
}));

vi.mock("@packages/ui/components/field", () => ({
   Field: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   FieldError: ({ errors }: { errors: string[] }) => (
      <span>{errors?.join(", ")}</span>
   ),
   FieldGroup: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   FieldLabel: ({ children }: { children: React.ReactNode }) => (
      <label>{children}</label>
   ),
}));

vi.mock("@packages/ui/components/spinner", () => ({
   Spinner: ({ className }: { className?: string }) => (
      <span data-testid="spinner" className={className} />
   ),
}));

import { TagForm } from "@/routes/_authenticated/$slug/$teamSlug/_dashboard/-tags/tags-form";

afterEach(() => {
   cleanup();
   mockCreateShouldFail = false;
   mockUpdateShouldFail = false;
});

function wrapper({ children }: { children: React.ReactNode }) {
   const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
   });
   return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
   );
}

describe("TagForm", () => {
   it("renders create mode title", () => {
      render(<TagForm mode="create" onSuccess={vi.fn()} />, { wrapper });
      expect(screen.getByText("Novo Centro de Custo")).toBeDefined();
   });

   it("renders edit mode title", () => {
      render(
         <TagForm
            mode="edit"
            tag={{
               id: "1",
               name: "Marketing",
               color: "#6366f1",
               description: null,
            }}
            onSuccess={vi.fn()}
         />,
         { wrapper },
      );
      expect(screen.getByText("Editar Centro de Custo")).toBeDefined();
   });

   it("renders name input with default empty value in create mode", () => {
      render(<TagForm mode="create" onSuccess={vi.fn()} />, { wrapper });
      const input = screen.getByPlaceholderText(
         "Ex: Marketing, Recursos Humanos",
      );
      expect((input as HTMLInputElement).value).toBe("");
   });

   it("renders name input pre-filled in edit mode", () => {
      render(
         <TagForm
            mode="edit"
            tag={{
               id: "1",
               name: "Marketing",
               color: "#6366f1",
               description: "Desc",
            }}
            onSuccess={vi.fn()}
         />,
         { wrapper },
      );
      const input = screen.getByPlaceholderText(
         "Ex: Marketing, Recursos Humanos",
      );
      expect((input as HTMLInputElement).value).toBe("Marketing");
   });

   it("submit button shows create label in create mode", () => {
      render(<TagForm mode="create" onSuccess={vi.fn()} />, { wrapper });
      expect(screen.getByText("Criar centro de custo")).toBeDefined();
   });

   it("submit button shows save label in edit mode", () => {
      render(
         <TagForm
            mode="edit"
            tag={{
               id: "1",
               name: "Marketing",
               color: "#6366f1",
               description: null,
            }}
            onSuccess={vi.fn()}
         />,
         { wrapper },
      );
      expect(screen.getByText("Salvar alterações")).toBeDefined();
   });

   it("calls create mutation on form submit in create mode", async () => {
      render(<TagForm mode="create" onSuccess={vi.fn()} />, { wrapper });

      const input = screen.getByPlaceholderText(
         "Ex: Marketing, Recursos Humanos",
      );
      fireEvent.change(input, { target: { value: "Novo Tag" } });

      const submitBtn = screen.getByText("Criar centro de custo");
      fireEvent.click(submitBtn);

      await waitFor(() => {
         expect(mockCreateMutate).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Novo Tag" }),
         );
      });
   });

   it("calls update mutation on form submit in edit mode", async () => {
      render(
         <TagForm
            mode="edit"
            tag={{
               id: "tag-123",
               name: "Marketing",
               color: "#6366f1",
               description: null,
            }}
            onSuccess={vi.fn()}
         />,
         { wrapper },
      );

      const input = screen.getByPlaceholderText(
         "Ex: Marketing, Recursos Humanos",
      );
      fireEvent.change(input, { target: { value: "Marketing Atualizado" } });

      const submitBtn = screen.getByText("Salvar alterações");
      fireEvent.click(submitBtn);

      await waitFor(() => {
         expect(mockUpdateMutate).toHaveBeenCalledWith(
            expect.objectContaining({
               id: "tag-123",
               name: "Marketing Atualizado",
            }),
         );
      });
   });

   it("renders description textarea", () => {
      const { getByPlaceholderText } = render(
         <TagForm mode="create" onSuccess={vi.fn()} />,
         { wrapper },
      );
      const textarea = getByPlaceholderText(
         "Ex: Projeto X, Cliente Y, viagem de negócios",
      );
      expect(textarea).toBeDefined();
   });

   it("pre-fills description in edit mode", () => {
      const { getByPlaceholderText } = render(
         <TagForm
            mode="edit"
            tag={{
               id: "1",
               name: "Marketing",
               color: "#6366f1",
               description: "Minha descrição",
            }}
            onSuccess={vi.fn()}
         />,
         { wrapper },
      );
      const textarea = getByPlaceholderText(
         "Ex: Projeto X, Cliente Y, viagem de negócios",
      );
      expect((textarea as HTMLTextAreaElement).value).toBe("Minha descrição");
   });

   it("calls onSuccess callback after successful create", async () => {
      const { toast } = await import("sonner");
      const onSuccess = vi.fn();
      render(<TagForm mode="create" onSuccess={onSuccess} />, { wrapper });

      const input = screen.getByPlaceholderText(
         "Ex: Marketing, Recursos Humanos",
      );
      fireEvent.change(input, { target: { value: "Novo Tag" } });
      fireEvent.click(screen.getByText("Criar centro de custo"));

      await waitFor(() => {
         expect(toast.success).toHaveBeenCalledWith(
            "Centro de custo criado com sucesso.",
         );
         expect(onSuccess).toHaveBeenCalled();
      });
   });

   it("shows error toast on create failure", async () => {
      const { toast } = await import("sonner");
      mockCreateShouldFail = true;
      render(<TagForm mode="create" onSuccess={vi.fn()} />, { wrapper });

      const input = screen.getByPlaceholderText(
         "Ex: Marketing, Recursos Humanos",
      );
      fireEvent.change(input, { target: { value: "Vai Falhar" } });
      fireEvent.click(screen.getByText("Criar centro de custo"));

      await waitFor(() => {
         expect(toast.error).toHaveBeenCalledWith("Erro de servidor");
      });
   });

   it("calls onSuccess callback after successful update", async () => {
      const { toast } = await import("sonner");
      const onSuccess = vi.fn();
      render(
         <TagForm
            mode="edit"
            tag={{
               id: "tag-1",
               name: "Velho",
               color: "#6366f1",
               description: null,
            }}
            onSuccess={onSuccess}
         />,
         { wrapper },
      );

      fireEvent.click(screen.getByText("Salvar alterações"));

      await waitFor(() => {
         expect(toast.success).toHaveBeenCalledWith(
            "Centro de custo atualizado com sucesso.",
         );
         expect(onSuccess).toHaveBeenCalled();
      });
   });

   it("shows error toast on update failure", async () => {
      const { toast } = await import("sonner");
      mockUpdateShouldFail = true;
      render(
         <TagForm
            mode="edit"
            tag={{
               id: "tag-2",
               name: "Velho",
               color: "#6366f1",
               description: null,
            }}
            onSuccess={vi.fn()}
         />,
         { wrapper },
      );

      fireEvent.click(screen.getByText("Salvar alterações"));

      await waitFor(() => {
         expect(toast.error).toHaveBeenCalledWith("Erro de servidor");
      });
   });
});
