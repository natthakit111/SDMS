import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-context";
import { LanguageProvider } from "@/context/language-context";

const { mockPost, mockGet } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock("@/lib/api/axiosInstance", () => ({
  default: { post: mockPost, get: mockGet },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function Harness() {
  const { user, login, register } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? JSON.stringify(user) : "null"}</div>
      <button
        onClick={() => login("0812345678", "somepassword", false)}
      >
        login
      </button>
      <button
        onClick={() =>
          register({
            password: "somepassword",
            name: "สมชาย ใจดี",
            phone: "0812345678",
            email: "somchai@gmail.com",
          })
        }
      >
        register
      </button>
    </div>
  );
}

const renderHarness = () =>
  render(
    <LanguageProvider>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </LanguageProvider>,
  );

describe("AuthProvider — login/register -> mapUser", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    document.cookie = "auth_hint=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  });

  test("login สำเร็จ -> map ฟิลด์จาก backend เป็น User shape ที่ frontend ใช้ (name รวม first+last, passwordMustChange เป็น boolean)", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          user: {
            user_id: 42,
            username: "0812345678",
            role: "tenant",
            first_name: "สมชาย",
            last_name: "ใจดี",
            email: "somchai@gmail.com",
            phone: "0812345678",
            password_must_change: 1,
          },
        },
      },
    });

    renderHarness();
    fireEvent.click(screen.getByText("login"));

    await waitFor(() => {
      const parsed = JSON.parse(screen.getByTestId("user").textContent || "null");
      expect(parsed).toMatchObject({
        id: "42",
        username: "0812345678",
        name: "สมชาย ใจดี",
        role: "tenant",
        passwordMustChange: true,
      });
    });

    expect(mockPost).toHaveBeenCalledWith("/auth/login", {
      username: "0812345678",
      password: "somepassword",
      rememberMe: false,
    });
  });

  test("register สำเร็จ -> เรียก /auth/register แล้ว login ต่อทันทีด้วยเบอร์โทรเดียวกัน", async () => {
    mockPost
      .mockResolvedValueOnce({ data: { data: { user_id: 99 } } }) // POST /auth/register
      .mockResolvedValueOnce({
        data: {
          data: {
            user: {
              user_id: 99,
              username: "0812345678",
              role: "tenant",
              first_name: "สมชาย",
              last_name: "ใจดี",
              password_must_change: 0,
            },
          },
        },
      }); // POST /auth/login (chained)

    renderHarness();
    fireEvent.click(screen.getByText("register"));

    await waitFor(() => {
      const parsed = JSON.parse(screen.getByTestId("user").textContent || "null");
      expect(parsed).toMatchObject({ id: "99", passwordMustChange: false });
    });

    expect(mockPost).toHaveBeenNthCalledWith(1, "/auth/register", {
      password: "somepassword",
      name: "สมชาย ใจดี",
      email: "somchai@gmail.com",
      phone: "0812345678",
      role: "tenant",
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/auth/login", {
      username: "0812345678",
      password: "somepassword",
      rememberMe: false,
    });
  });
});
