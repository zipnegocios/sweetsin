import { describe, it, expect } from "vitest";
import {
  registerCustomer,
  listActiveStaff,
  authenticateUser,
  updateUserPreferredLocale,
  authenticateStaffByPin,
  registerStaffUser,
  resetStaffPin,
  generatePin,
  deleteStaffUser,
  updateStaffProfile,
  replaceStaffPhoto,
  removeStaffPhoto,
  MAX_STAFF_PHOTO_BYTES,
} from "./use-cases";
import { hashPassword } from "./auth";
import type { User, UserRole } from "./entities";
import type { UserRepository } from "./ports";

function fakeUserRepo(initial: User[] = []): UserRepository & { created: Omit<User, "id">[] } {
  const users = [...initial];
  const created: Omit<User, "id">[] = [];
  return {
    created,
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async listActiveByRole(role: UserRole) {
      return users.filter((u) => u.role === role && u.isActive);
    },
    async create(user) {
      created.push(user);
      const inserted = { ...user, id: `user-${created.length}` };
      users.push(inserted);
      return inserted;
    },
    async update(id, data) {
      const user = users.find((u) => u.id === id);
      if (!user) throw new Error(`User not found: ${id}`);
      Object.assign(user, data);
      return user;
    },
  };
}

describe("registerCustomer", () => {
  it("creates a new customer user", async () => {
    const repo = fakeUserRepo([]);
    const user = await registerCustomer(repo, { name: "Jane Doe", email: "jane@example.com", password: "hunter2", preferredLocale: "en" });

    expect(user.role).toBe("customer");
    expect(user.isActive).toBe(true);
    expect(repo.created).toHaveLength(1);
  });

  it("throws when the email is already registered", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Existing", email: "jane@example.com", role: "customer", pinHash: null, passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    await expect(
      registerCustomer(repo, { name: "Jane Doe", email: "jane@example.com", password: "hunter2", preferredLocale: "en" }),
    ).rejects.toThrow("User already exists with email: jane@example.com");
  });

  it("hashes the password before persisting the new customer", async () => {
    const repo = fakeUserRepo([]);

    const user = await registerCustomer(repo, { name: "New Customer", email: "new@example.com", password: "hunter2", preferredLocale: "en" });

    expect(user.role).toBe("customer");
    expect(repo.created[0].passwordHash).not.toBe("hunter2");
    expect(repo.created[0].passwordHash).not.toBeNull();
  });
});

describe("listActiveStaff", () => {
  it("returns only active users with the given role", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Active Despachador", email: null, role: "despachador", pinHash: "x", passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
      { id: "u2", name: "Inactive Despachador", email: null, role: "despachador", pinHash: "x", passwordHash: null, isActive: false, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
      { id: "u3", name: "Delivery", email: null, role: "delivery", pinHash: "x", passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    const result = await listActiveStaff(repo, "despachador");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u1");
  });
});

describe("authenticateUser", () => {
  it("returns the user when email and password match an active account", async () => {
    const passwordHash = await hashPassword("s3cret!");
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Admin", email: "jane@sweetsin.com.au", role: "admin", pinHash: null, passwordHash, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    const user = await authenticateUser(repo, "jane@sweetsin.com.au", "s3cret!");

    expect(user?.id).toBe("u1");
  });

  it("returns null when the password does not match", async () => {
    const passwordHash = await hashPassword("s3cret!");
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Admin", email: "jane@sweetsin.com.au", role: "admin", pinHash: null, passwordHash, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    expect(await authenticateUser(repo, "jane@sweetsin.com.au", "wrong")).toBeNull();
  });

  it("returns null for an inactive user even with the correct password", async () => {
    const passwordHash = await hashPassword("s3cret!");
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Admin", email: "jane@sweetsin.com.au", role: "admin", pinHash: null, passwordHash, isActive: false, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    expect(await authenticateUser(repo, "jane@sweetsin.com.au", "s3cret!")).toBeNull();
  });

  it("returns null for a user with no password set (staff PIN accounts)", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Delivery Bot", email: null, role: "delivery", pinHash: "some-pin-hash", passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    expect(await authenticateUser(repo, "unused@example.com", "anything")).toBeNull();
  });

  it("returns null when no user exists with that email", async () => {
    const repo = fakeUserRepo([]);

    expect(await authenticateUser(repo, "nobody@example.com", "anything")).toBeNull();
  });
});

describe("updateUserPreferredLocale", () => {
  it("updates the user's preferred locale", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Doe", email: "jane@example.com", role: "customer", pinHash: null, passwordHash: null, isActive: true, preferredLocale: "en", failedPinAttempts: 0, pinLockedUntil: null },
    ]);

    const updated = await updateUserPreferredLocale(repo, "u1", "es");

    expect(updated.preferredLocale).toBe("es");
  });

  it("throws when the user does not exist", async () => {
    const repo = fakeUserRepo([]);

    await expect(updateUserPreferredLocale(repo, "missing", "es")).rejects.toThrow("User not found: missing");
  });
});

function makeFakeUserRepo(users: User[]): UserRepository {
  const store = new Map(users.map((u) => [u.id, u]));
  return {
    findById: async (id) => store.get(id) ?? null,
    findByEmail: async (email) => [...store.values()].find((u) => u.email === email) ?? null,
    listActiveByRole: async (role) => [...store.values()].filter((u) => u.role === role && u.isActive),
    create: async (data) => {
      const user = { ...data, id: `user-${store.size + 1}` };
      store.set(user.id, user);
      return user;
    },
    update: async (id, data) => {
      const user = store.get(id);
      if (!user) throw new Error("not found");
      const updated = { ...user, ...data };
      store.set(id, updated);
      return updated;
    },
    recordFailedPinAttempt: async (id, lockedUntil) => {
      const user = store.get(id);
      if (!user) return;
      store.set(id, { ...user, failedPinAttempts: user.failedPinAttempts + 1, pinLockedUntil: lockedUntil });
    },
    resetPinAttempts: async (id) => {
      const user = store.get(id);
      if (!user) return;
      store.set(id, { ...user, failedPinAttempts: 0, pinLockedUntil: null });
    },
    deleteStaff: async (id) => {
      store.delete(id);
    },
  };
}

const baseStaff: User = {
  id: "staff-1",
  name: "Ana Despachadora",
  email: "ana@sweetsin.com",
  role: "despachador",
  pinHash: null,
  passwordHash: null,
  isActive: true,
  preferredLocale: "es",
  failedPinAttempts: 0,
  pinLockedUntil: null,
};

describe("authenticateStaffByPin", () => {
  it("autentica con PIN correcto", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, pinHash }]);

    const user = await authenticateStaffByPin(repo, "ana@sweetsin.com", "123456");

    expect(user?.id).toBe("staff-1");
  });

  it("rechaza PIN incorrecto e incrementa el contador", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, pinHash }]);

    const user = await authenticateStaffByPin(repo, "ana@sweetsin.com", "000000");

    expect(user).toBeNull();
    const stored = await repo.findByEmail("ana@sweetsin.com");
    expect(stored?.failedPinAttempts).toBe(1);
  });

  it("bloquea tras 5 intentos fallidos", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, pinHash, failedPinAttempts: 4 }]);

    await authenticateStaffByPin(repo, "ana@sweetsin.com", "000000");
    const lockedResult = await authenticateStaffByPin(repo, "ana@sweetsin.com", "123456");

    expect(lockedResult).toBeNull();
    const stored = await repo.findByEmail("ana@sweetsin.com");
    expect(stored?.pinLockedUntil).not.toBeNull();
  });

  it("rechaza si isActive es false", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, pinHash, isActive: false }]);

    await expect(authenticateStaffByPin(repo, "ana@sweetsin.com", "123456")).resolves.toBeNull();
  });

  it("rechaza rol customer", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, role: "customer", pinHash }]);

    await expect(authenticateStaffByPin(repo, "ana@sweetsin.com", "123456")).resolves.toBeNull();
  });
});

describe("registerStaffUser / resetStaffPin", () => {
  it("crea un despachador con PIN de 6 digitos y lo devuelve en texto plano una sola vez", async () => {
    const repo = makeFakeUserRepo([]);

    const { user, plainPin } = await registerStaffUser(repo, {
      name: "Ana",
      email: "ana@sweetsin.com",
      role: "despachador",
      password: "hunter2hunter2",
    });

    expect(plainPin).toMatch(/^\d{6}$/);
    expect(user.pinHash).not.toBeNull();
    expect(user.pinHash).not.toBe(plainPin);
  });

  it("resetStaffPin genera un PIN nuevo y resetea el lockout", async () => {
    const repo = makeFakeUserRepo([{ ...baseStaff, failedPinAttempts: 3, pinLockedUntil: new Date() }]);

    const plainPin = await resetStaffPin(repo, "staff-1");

    expect(plainPin).toMatch(/^\d{6}$/);
    const stored = await repo.findById("staff-1");
    expect(stored?.failedPinAttempts).toBe(0);
    expect(stored?.pinLockedUntil).toBeNull();
  });
});

describe("generatePin", () => {
  it("genera siempre 6 digitos numericos, incluso con ceros a la izquierda", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });
});

describe("deleteStaffUser", () => {
  it("elimina a un miembro del staff", async () => {
    const repo = makeFakeUserRepo([baseStaff]);

    await deleteStaffUser(repo, "staff-1");

    expect(await repo.findById("staff-1")).toBeNull();
  });

  it("rechaza eliminar a un admin o a un cliente", async () => {
    const repo = makeFakeUserRepo([
      { ...baseStaff, id: "admin-1", role: "admin" },
      { ...baseStaff, id: "customer-1", role: "customer" },
    ]);

    await expect(deleteStaffUser(repo, "admin-1")).rejects.toThrow("Only staff");
    await expect(deleteStaffUser(repo, "customer-1")).rejects.toThrow("Only staff");
    expect(await repo.findById("admin-1")).not.toBeNull();
  });

  it("falla si el usuario no existe", async () => {
    await expect(deleteStaffUser(makeFakeUserRepo([]), "nope")).rejects.toThrow("not found");
  });
});

function fakePhotos() {
  const objects = new Set<string>();
  return {
    objects,
    storage: {
      put: async (key: string) => void objects.add(key),
      delete: async (key: string) => void objects.delete(key),
      createViewUrl: async (key: string) => `https://signed/${key}`,
    },
  };
}

const profileInput = {
  name: "Ana Pérez",
  email: "ana.perez@sweetsin.com",
  role: "delivery" as const,
  phone: "0412 345 678",
  emergencyContactName: "Luis",
  emergencyContactPhone: "0400 111 222",
  internalNotes: "Zona norte",
  preferredLocale: "en" as const,
};

describe("updateStaffProfile", () => {
  it("actualiza todos los campos de la ficha", async () => {
    const repo = makeFakeUserRepo([baseStaff]);

    const updated = await updateStaffProfile(repo, "staff-1", profileInput);

    expect(updated).toMatchObject(profileInput);
  });

  it("recorta espacios y guarda null en los textos opcionales vacíos", async () => {
    const repo = makeFakeUserRepo([baseStaff]);

    const updated = await updateStaffProfile(repo, "staff-1", { ...profileInput, name: "  Ana  ", phone: "   ", internalNotes: "" });

    expect(updated.name).toBe("Ana");
    expect(updated.phone).toBeNull();
    expect(updated.internalNotes).toBeNull();
  });

  it("rechaza un email ya usado por otro usuario, pero permite conservar el propio", async () => {
    const repo = makeFakeUserRepo([baseStaff, { ...baseStaff, id: "staff-2", email: "otro@sweetsin.com" }]);

    await expect(updateStaffProfile(repo, "staff-1", { ...profileInput, email: "otro@sweetsin.com" })).rejects.toThrow("already exists");
    await expect(updateStaffProfile(repo, "staff-1", { ...profileInput, email: baseStaff.email! })).resolves.toBeDefined();
  });

  it("hashea la contraseña solo si se envía una nueva", async () => {
    const repo = makeFakeUserRepo([{ ...baseStaff, passwordHash: "old" }]);

    const same = await updateStaffProfile(repo, "staff-1", profileInput);
    expect(same.passwordHash).toBe("old");

    const changed = await updateStaffProfile(repo, "staff-1", { ...profileInput, password: "nuevaclave123" });
    expect(changed.passwordHash).not.toBe("old");
    expect(changed.passwordHash).not.toBe("nuevaclave123");
  });

  it("rechaza nombre vacío, roles no staff y usuarios que no son staff", async () => {
    const repo = makeFakeUserRepo([baseStaff, { ...baseStaff, id: "admin-1", role: "admin" }]);

    await expect(updateStaffProfile(repo, "staff-1", { ...profileInput, name: "  " })).rejects.toThrow("Name");
    await expect(updateStaffProfile(repo, "staff-1", { ...profileInput, role: "admin" as never })).rejects.toThrow("role");
    await expect(updateStaffProfile(repo, "admin-1", profileInput)).rejects.toThrow("Only staff");
    await expect(updateStaffProfile(repo, "nope", profileInput)).rejects.toThrow("not found");
  });
});

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe("replaceStaffPhoto / removeStaffPhoto", () => {
  it("guarda la foto con una key propia del usuario y la registra en el usuario", async () => {
    const repo = makeFakeUserRepo([baseStaff]);
    const { storage, objects } = fakePhotos();

    const user = await replaceStaffPhoto({ users: repo, photos: storage }, "staff-1", JPEG);

    expect(user.photoKey).toMatch(/^staff-1\/\d+\.jpg$/);
    expect(objects.has(user.photoKey!)).toBe(true);
  });

  it("borra la foto anterior al reemplazarla", async () => {
    const repo = makeFakeUserRepo([{ ...baseStaff, photoKey: "staff-1/old.jpg" }]);
    const { storage, objects } = fakePhotos();
    objects.add("staff-1/old.jpg");

    await replaceStaffPhoto({ users: repo, photos: storage }, "staff-1", JPEG);

    expect(objects.has("staff-1/old.jpg")).toBe(false);
    expect(objects.size).toBe(1);
  });

  it("rechaza archivos que no son JPEG o que superan el tamaño máximo", async () => {
    const repo = makeFakeUserRepo([baseStaff]);
    const { storage, objects } = fakePhotos();

    await expect(replaceStaffPhoto({ users: repo, photos: storage }, "staff-1", Uint8Array.from([1, 2, 3]))).rejects.toThrow("JPEG");
    const huge = new Uint8Array(MAX_STAFF_PHOTO_BYTES + 1);
    huge.set([0xff, 0xd8, 0xff]);
    await expect(replaceStaffPhoto({ users: repo, photos: storage }, "staff-1", huge)).rejects.toThrow("large");
    expect(objects.size).toBe(0);
  });

  it("removeStaffPhoto limpia la key y borra el objeto", async () => {
    const repo = makeFakeUserRepo([{ ...baseStaff, photoKey: "staff-1/a.jpg" }]);
    const { storage, objects } = fakePhotos();
    objects.add("staff-1/a.jpg");

    const user = await removeStaffPhoto({ users: repo, photos: storage }, "staff-1");

    expect(user.photoKey).toBeNull();
    expect(objects.size).toBe(0);
  });

  it("deleteStaffUser borra también la foto", async () => {
    const repo = makeFakeUserRepo([{ ...baseStaff, photoKey: "staff-1/a.jpg" }]);
    const { storage, objects } = fakePhotos();
    objects.add("staff-1/a.jpg");

    await deleteStaffUser(repo, "staff-1", storage);

    expect(objects.size).toBe(0);
  });
});
