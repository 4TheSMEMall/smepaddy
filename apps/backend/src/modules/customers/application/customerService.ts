import { AppError } from "../../../shared/application/AppError.js";
import { businessCacheKey, getCached, invalidateBusinessCache } from "../../../shared/infrastructure/cache.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";

type CreateInput = { name?: string; phone?: string; email?: string; address?: string; notes?: string };
type UpdateInput = Partial<CreateInput>;

function toDto(c: { id: string; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export class CustomerService {
  async list(context: AuthenticatedContext, opts: { search?: string } = {}) {
    const businessProfileId = this.requireBusiness(context);
    return getCached(
      businessCacheKey(businessProfileId, "customers", [opts.search ?? ""]),
      30_000,
      async () => {
        const customers = await prisma.customer.findMany({
          where: {
            businessProfileId,
            ...(opts.search ? {
              OR: [
                { name: { contains: opts.search, mode: "insensitive" } },
                { phone: { contains: opts.search, mode: "insensitive" } },
                { email: { contains: opts.search, mode: "insensitive" } },
              ],
            } : {}),
          },
          orderBy: { name: "asc" },
        });
        return { customers: customers.map(toDto) };
      },
    );
  }

  async getById(context: AuthenticatedContext, id: string) {
    const businessProfileId = this.requireBusiness(context);
    const [customer, invoices, sales] = await Promise.all([
      prisma.customer.findFirst({ where: { id, businessProfileId } }),
      prisma.invoice.findMany({
        where: { customerId: id, businessProfileId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, status: true, subtotalKobo: true, amountPaidKobo: true, balanceKobo: true, dueDate: true, createdAt: true },
      }),
      prisma.saleTransaction.findMany({
        where: { customerId: id, businessProfileId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, paymentStatus: true, subtotalKobo: true, amountPaidKobo: true, balanceKobo: true, createdAt: true, lineItems: { select: { stockItem: { select: { name: true } } } } },
      }),
    ]);

    if (!customer) throw new AppError("Customer not found", 404, "NOT_FOUND");

    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceKobo, 0);
    const totalSpent = sales.reduce((sum, s) => sum + s.amountPaidKobo, 0);

    return {
      customer: {
        ...toDto(customer),
        stats: {
          totalInvoices: invoices.length,
          totalSales: sales.length,
          totalOutstanding: totalOutstanding / 100,
          totalSpent: totalSpent / 100,
        },
      },
      invoices: invoices.map((inv) => ({
        id: inv.id,
        status: inv.status,
        subtotal: inv.subtotalKobo / 100,
        amountPaid: inv.amountPaidKobo / 100,
        balance: inv.balanceKobo / 100,
        dueDate: inv.dueDate.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
      sales: sales.map((s) => ({
        id: s.id,
        paymentStatus: s.paymentStatus,
        subtotal: s.subtotalKobo / 100,
        amountPaid: s.amountPaidKobo / 100,
        balance: s.balanceKobo / 100,
        itemNames: s.lineItems.map((l) => l.stockItem.name),
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  async create(context: AuthenticatedContext, input: CreateInput) {
    const businessProfileId = this.requireBusiness(context);
    if (!input.name?.trim()) throw new AppError("Customer name is required", 422, "REQUIRED_FIELD");

    const customer = await prisma.customer.create({
      data: {
        businessProfileId,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    invalidateBusinessCache(businessProfileId, ["customers"]);
    return { customer: toDto(customer) };
  }

  async update(context: AuthenticatedContext, id: string, input: UpdateInput) {
    const businessProfileId = this.requireBusiness(context);
    const existing = await prisma.customer.findFirst({ where: { id, businessProfileId } });
    if (!existing) throw new AppError("Customer not found", 404, "NOT_FOUND");

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        phone: input.phone !== undefined ? (input.phone?.trim() || null) : undefined,
        email: input.email !== undefined ? (input.email?.trim() || null) : undefined,
        address: input.address !== undefined ? (input.address?.trim() || null) : undefined,
        notes: input.notes !== undefined ? (input.notes?.trim() || null) : undefined,
      },
    });

    invalidateBusinessCache(businessProfileId, ["customers"]);
    return { customer: toDto(updated) };
  }

  async remove(context: AuthenticatedContext, id: string) {
    const businessProfileId = this.requireBusiness(context);
    const existing = await prisma.customer.findFirst({ where: { id, businessProfileId } });
    if (!existing) throw new AppError("Customer not found", 404, "NOT_FOUND");
    await prisma.customer.delete({ where: { id } });
    invalidateBusinessCache(businessProfileId, ["customers"]);
    return { deleted: true };
  }

  async getUnpaidInvoices(context: AuthenticatedContext, customerId: string) {
    const businessProfileId = this.requireBusiness(context);
    const invoices = await prisma.invoice.findMany({
      where: {
        businessProfileId,
        customerId,
        balanceKobo: { gt: 0 },
      },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        status: true,
        subtotalKobo: true,
        amountPaidKobo: true,
        balanceKobo: true,
        dueDate: true,
        createdAt: true,
        items: { select: { description: true }, take: 1 },
      },
    });

    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        status: inv.status,
        subtotal: inv.subtotalKobo / 100,
        amountPaid: inv.amountPaidKobo / 100,
        balance: inv.balanceKobo / 100,
        dueDate: inv.dueDate.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        description: inv.items[0]?.description ?? "Invoice",
      })),
    };
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) throw new AppError("Business required", 403, "BUSINESS_REQUIRED");
    return context.business.id;
  }
}

export const customerService = new CustomerService();
