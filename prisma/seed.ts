import { PrismaClient, DealStageType, DocumentType, DocumentStatus, MediaType, NotificationType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";

async function main() {
  console.log("Seeding database...");

  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.mediaFile.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.task.deleteMany();
  await prisma.stageHistory.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const adminRole = await prisma.role.create({ data: { name: "ADMIN" } });
  const managerRole = await prisma.role.create({ data: { name: "MANAGER" } });
  const viewerRole = await prisma.role.create({ data: { name: "VIEWER" } });

  const admin = await prisma.user.create({
    data: {
      name: "Администратор Системы",
      email: "admin@auto-crm.local",
      passwordHash,
      roleId: adminRole.id,
    },
  });

  const managerAlex = await prisma.user.create({
    data: {
      name: "Александр Иванов",
      email: "alex@auto-crm.local",
      passwordHash,
      roleId: managerRole.id,
      telegramChatId: "100001",
    },
  });

  const managerMaria = await prisma.user.create({
    data: {
      name: "Мария Петрова",
      email: "maria@auto-crm.local",
      passwordHash,
      roleId: managerRole.id,
      telegramChatId: "100002",
    },
  });

  const viewer = await prisma.user.create({
    data: {
      name: "Наблюдатель Офис",
      email: "viewer@auto-crm.local",
      passwordHash,
      roleId: viewerRole.id,
    },
  });

  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // ─── Deal 1: Customs stage (active, overdue) ─────────────────────────────

  const deal1 = await prisma.deal.create({
    data: {
      clientName: "Иван Петров",
      phone: "+7 999 123-45-67",
      email: "ivan.petrov@mail.ru",
      vin: "WAUZZZ4G5DN123456",
      carBrand: "Audi",
      carModel: "A6",
      carYear: 2023,
      purchasePrice: 2850000,
      prepayment: 500000,
      balance: 2350000,
      destinationCity: "Москва",
      destinationCountry: "Россия",
      managerId: managerAlex.id,
      currentStage: DealStageType.CUSTOMS,
      stageEnteredAt: daysAgo(12),
      expectedArrival: daysAgo(3),
      priority: 2,
    },
  });

  await prisma.shipment.create({
    data: {
      dealId: deal1.id,
      purchaseDate: daysAgo(45),
      shippingDate: daysAgo(30),
      expectedArrival: daysAgo(3),
      customsCompleted: null,
    },
  });

  await prisma.stageHistory.createMany({
    data: [
      { dealId: deal1.id, fromStage: DealStageType.SEARCH, toStage: DealStageType.INVOICE, changedById: managerAlex.id, createdAt: daysAgo(50) },
      { dealId: deal1.id, fromStage: DealStageType.INVOICE, toStage: DealStageType.PREPARATION, changedById: managerAlex.id, createdAt: daysAgo(40) },
      { dealId: deal1.id, fromStage: DealStageType.PREPARATION, toStage: DealStageType.CUSTOMS, changedById: managerAlex.id, createdAt: daysAgo(12) },
    ],
  });

  for (const type of Object.values(DocumentType)) {
    await prisma.document.create({
      data: {
        dealId: deal1.id,
        type,
        status: type === DocumentType.PAYMENT ? DocumentStatus.VERIFIED : DocumentStatus.RECEIVED,
        fileUrl: type !== DocumentType.PAYMENT ? `https://storage.auto-crm.local/deals/${deal1.id}/${type.toLowerCase()}.pdf` : `https://storage.auto-crm.local/deals/${deal1.id}/payment.pdf`,
        uploadedById: managerAlex.id,
        uploadedAt: daysAgo(35),
      },
    });
  }

  const task1 = await prisma.task.create({
    data: {
      title: "Проверить таможенную декларацию",
      description: "Сверить VIN и стоимость с инвойсом",
      link: "https://customs.example.gov/track/12345",
      dealId: deal1.id,
      createdById: managerAlex.id,
    },
  });

  await prisma.mediaFile.create({
    data: {
      type: MediaType.PHOTO,
      fileName: "audi-a6-front.jpg",
      fileUrl: `https://storage.auto-crm.local/deals/${deal1.id}/audi-a6-front.jpg`,
      thumbnailUrl: `https://storage.auto-crm.local/deals/${deal1.id}/thumb-audi-a6-front.jpg`,
      size: 2048576,
      dealId: deal1.id,
      uploadedById: managerAlex.id,
    },
  });

  await prisma.mediaFile.create({
    data: {
      type: MediaType.VIDEO,
      fileName: "customs-inspection.mp4",
      fileUrl: `https://storage.auto-crm.local/tasks/${task1.id}/customs-inspection.mp4`,
      size: 15728640,
      taskId: task1.id,
      uploadedById: managerAlex.id,
    },
  });

  await prisma.comment.create({
    data: {
      text: "Клиент запросил ускоренное оформление. Документы полные.",
      dealId: deal1.id,
      authorId: managerAlex.id,
      createdAt: daysAgo(10),
    },
  });

  await prisma.reminder.create({
    data: {
      dealId: deal1.id,
      title: "Связаться с таможенным брокером",
      dueDate: daysAgo(1),
      completed: false,
    },
  });

  await prisma.notification.create({
    data: {
      dealId: deal1.id,
      userId: managerAlex.id,
      title: "Сделка переведена на этап «Таможня»",
      message: `Клиент: ${deal1.clientName}\nVIN: ${deal1.vin}\nЭтап: Подготовка → Таможня`,
      type: NotificationType.TELEGRAM,
      read: true,
      createdAt: daysAgo(12),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: managerAlex.id,
      entity: "Deal",
      entityId: deal1.id,
      action: "STAGE_CHANGE",
      oldValue: { currentStage: DealStageType.PREPARATION },
      newValue: { currentStage: DealStageType.CUSTOMS },
      createdAt: daysAgo(12),
    },
  });

  // ─── Deal 2: Transport stage ───────────────────────────────────────────────

  const deal2 = await prisma.deal.create({
    data: {
      clientName: "Елена Смирнова",
      phone: "+7 916 555-12-34",
      email: "elena.smirnova@gmail.com",
      vin: "WBAJA91060B234567",
      carBrand: "BMW",
      carModel: "X5",
      carYear: 2024,
      purchasePrice: 4200000,
      prepayment: 800000,
      balance: 3400000,
      destinationCity: "Санкт-Петербург",
      destinationCountry: "Россия",
      managerId: managerMaria.id,
      currentStage: DealStageType.TRANSPORT,
      stageEnteredAt: daysAgo(5),
      expectedArrival: daysFromNow(7),
      priority: 1,
    },
  });

  await prisma.shipment.create({
    data: {
      dealId: deal2.id,
      purchaseDate: daysAgo(60),
      shippingDate: daysAgo(20),
      expectedArrival: daysFromNow(7),
      customsCompleted: daysAgo(6),
    },
  });

  await prisma.stageHistory.create({
    data: {
      dealId: deal2.id,
      fromStage: DealStageType.CUSTOMS,
      toStage: DealStageType.TRANSPORT,
      changedById: managerMaria.id,
      createdAt: daysAgo(5),
    },
  });

  for (const type of Object.values(DocumentType)) {
    await prisma.document.create({
      data: {
        dealId: deal2.id,
        type,
        status: DocumentStatus.VERIFIED,
        fileUrl: `https://storage.auto-crm.local/deals/${deal2.id}/${type.toLowerCase()}.pdf`,
        uploadedById: managerMaria.id,
        uploadedAt: daysAgo(25),
      },
    });
  }

  await prisma.task.create({
    data: {
      title: "Отследить контейнер MSCU1234567",
      link: "https://tracking.example.com/MSCU1234567",
      dealId: deal2.id,
      createdById: managerMaria.id,
    },
  });

  await prisma.comment.create({
    data: {
      text: "Авто прошло таможню, в пути до СПб.",
      dealId: deal2.id,
      authorId: managerMaria.id,
    },
  });

  await prisma.reminder.create({
    data: {
      dealId: deal2.id,
      title: "Уведомить клиента о прибытии",
      dueDate: daysFromNow(5),
      completed: false,
    },
  });

  await prisma.notification.create({
    data: {
      dealId: deal2.id,
      userId: managerMaria.id,
      title: "Сделка переведена",
      message: `Клиент: ${deal2.clientName}\nVIN: ${deal2.vin}\nЭтап: Таможня → Транспортировка`,
      type: NotificationType.SYSTEM,
      read: false,
    },
  });

  // ─── Deal 3: Search stage (new) ────────────────────────────────────────────

  const deal3 = await prisma.deal.create({
    data: {
      clientName: "Дмитрий Козлов",
      phone: "+7 903 777-88-99",
      vin: "JTDKN3DU5A3456789",
      carBrand: "Toyota",
      carModel: "Camry",
      carYear: 2022,
      purchasePrice: 1800000,
      prepayment: 300000,
      balance: 1500000,
      destinationCity: "Казань",
      destinationCountry: "Россия",
      managerId: managerAlex.id,
      currentStage: DealStageType.SEARCH,
      stageEnteredAt: daysAgo(2),
      expectedArrival: daysFromNow(45),
      priority: 1,
    },
  });

  for (const type of Object.values(DocumentType)) {
    await prisma.document.create({
      data: {
        dealId: deal3.id,
        type,
        status: DocumentStatus.MISSING,
      },
    });
  }

  await prisma.stageHistory.create({
    data: {
      dealId: deal3.id,
      fromStage: DealStageType.SEARCH,
      toStage: DealStageType.SEARCH,
      changedById: managerAlex.id,
      createdAt: daysAgo(2),
    },
  });

  await prisma.task.create({
    data: {
      title: "Найти Camry 2022 LE, белый цвет",
      description: "Бюджет до $22 000, аукцион Copart или IAAI",
      dealId: deal3.id,
      createdById: managerAlex.id,
    },
  });

  // ─── Deal 4: Delivery (completed) ──────────────────────────────────────────

  const deal4 = await prisma.deal.create({
    data: {
      clientName: "Ольга Новикова",
      phone: "+7 921 333-44-55",
      email: "olga.novikova@yandex.ru",
      vin: "5YJSA1E26HF456789",
      carBrand: "Tesla",
      carModel: "Model S",
      carYear: 2021,
      purchasePrice: 3500000,
      prepayment: 700000,
      balance: 0,
      destinationCity: "Новосибирск",
      destinationCountry: "Россия",
      managerId: managerMaria.id,
      currentStage: DealStageType.DELIVERY,
      stageEnteredAt: daysAgo(3),
      expectedArrival: daysAgo(5),
      actualArrival: daysAgo(3),
      priority: 1,
    },
  });

  await prisma.shipment.create({
    data: {
      dealId: deal4.id,
      purchaseDate: daysAgo(90),
      shippingDate: daysAgo(50),
      expectedArrival: daysAgo(5),
      actualArrival: daysAgo(3),
      customsCompleted: daysAgo(15),
    },
  });

  await prisma.stageHistory.create({
    data: {
      dealId: deal4.id,
      fromStage: DealStageType.TRANSPORT,
      toStage: DealStageType.DELIVERY,
      changedById: managerMaria.id,
      createdAt: daysAgo(3),
    },
  });

  for (const type of Object.values(DocumentType)) {
    await prisma.document.create({
      data: {
        dealId: deal4.id,
        type,
        status: DocumentStatus.VERIFIED,
        fileUrl: `https://storage.auto-crm.local/deals/${deal4.id}/${type.toLowerCase()}.pdf`,
        uploadedById: managerMaria.id,
        uploadedAt: daysAgo(40),
      },
    });
  }

  await prisma.comment.create({
    data: {
      text: "Автомобиль передан клиенту. Сделка закрыта.",
      dealId: deal4.id,
      authorId: managerMaria.id,
      createdAt: daysAgo(3),
    },
  });

  // ─── Deal 5: Invoice stage ───────────────────────────────────────────────────

  const deal5 = await prisma.deal.create({
    data: {
      clientName: "Сергей Волков",
      phone: "+7 985 111-22-33",
      vin: "1HGBH41JXMN567890",
      carBrand: "Honda",
      carModel: "Accord",
      carYear: 2023,
      purchasePrice: 2100000,
      prepayment: 400000,
      balance: 1700000,
      destinationCity: "Екатеринбург",
      destinationCountry: "Россия",
      managerId: managerAlex.id,
      currentStage: DealStageType.INVOICE,
      stageEnteredAt: daysAgo(1),
      expectedArrival: daysFromNow(60),
      priority: 1,
    },
  });

  for (const type of Object.values(DocumentType)) {
    await prisma.document.create({
      data: {
        dealId: deal5.id,
        type,
        status: type === DocumentType.PAYMENT ? DocumentStatus.RECEIVED : DocumentStatus.MISSING,
        fileUrl: type === DocumentType.PAYMENT ? `https://storage.auto-crm.local/deals/${deal5.id}/payment.pdf` : null,
        uploadedById: type === DocumentType.PAYMENT ? managerAlex.id : null,
        uploadedAt: type === DocumentType.PAYMENT ? daysAgo(1) : null,
      },
    });
  }

  await prisma.notification.create({
    data: {
      dealId: deal5.id,
      userId: viewer.id,
      title: "Новая сделка в работе",
      message: `Менеджер: ${managerAlex.name}\nКлиент: ${deal5.clientName}\nЭтап: Инвойс`,
      type: NotificationType.SYSTEM,
      read: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      entity: "User",
      entityId: viewer.id,
      action: "LOGIN",
      newValue: { email: viewer.email },
    },
  });

  console.log("Seed completed.");
  console.log("");
  console.log("Roles:     ADMIN, MANAGER, VIEWER");
  console.log("Users:     admin@auto-crm.local, alex@auto-crm.local, maria@auto-crm.local, viewer@auto-crm.local");
  console.log(`Password:  ${PASSWORD}`);
  console.log("Deals:     5 (SEARCH, INVOICE, CUSTOMS, TRANSPORT, DELIVERY)");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
