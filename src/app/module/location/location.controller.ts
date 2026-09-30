import { Request, Response } from "express";
import { catchAsync } from "../../../shared/catchAsync";
import { locationService } from "./location.service";
import { sendResponse } from "../../../shared/sendResonse";
import status from "http-status";
import { IRequestUser } from "../../interface/requestUserInterface";


const create = catchAsync(async (req: Request, res: Response) => {
    const result = await locationService.create(req.body, (req.user as IRequestUser).id);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Location created successfully",
        data: result,
    });
});


const getAll = catchAsync(async (req: Request, res: Response) => {
    const result = await locationService.getAll(req.query as any);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Locations fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

// ── GET /locations/search?q= ──────────────────────────────────────────────────

const search = catchAsync(async (req: Request, res: Response) => {
    const query = (req.query.q as string) ?? "";
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const result = await locationService.search(query, limit);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Search results fetched",
        data: result,
    });
});

// ── GET /locations/:id ────────────────────────────────────────────────────────

const getById = catchAsync(async (req: Request, res: Response) => {
    const result = await locationService.getById(req.params.id as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Location fetched successfully",
        data: result,
    });
});

// ── GET /locations/code/:code ─────────────────────────────────────────────────

const getByCode = catchAsync(async (req: Request, res: Response) => {
    const result = await locationService.getByCode(req.params.code as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Location fetched successfully",
        data: result,
    });
});

// ── PATCH /locations/:id ──────────────────────────────────────────────────────

const update = catchAsync(async (req: Request, res: Response) => {
    const result = await locationService.update(
        req.params.id as string,
        req.body,
        (req.user as IRequestUser).id
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Location updated successfully",
        data: result,
    });
});

// ── PATCH /locations/:id/block ────────────────────────────────────────────────

const block = catchAsync(async (req: Request, res: Response) => {
    const result = await locationService.block(
        req.params.id as string,
        req.body,
        (req.user as IRequestUser).id
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Location blocked successfully",
        data: result,
    });
});

// ── PATCH /locations/:id/unblock ──────────────────────────────────────────────

const unblock = catchAsync(async (req: Request, res: Response) => {
    const result = await locationService.unblock(
        req.params.id as string,
        (req.user as IRequestUser).id
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Location unblocked successfully",
        data: result,
    });
});

// ── DELETE /locations/:id ─────────────────────────────────────────────────────

const softDelete = catchAsync(async (req: Request, res: Response) => {
    await locationService.softDelete(req.params.id as string, (req.user as IRequestUser).id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Location deleted successfully",
        data: null,
    });
});

// ── PATCH /locations/:id/restore ──────────────────────────────────────────────

const restore = catchAsync(async (req: Request, res: Response) => {
    const result = await locationService.restore(
        req.params.id as string,
        (req.user as IRequestUser).id
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Location restored successfully",
        data: result,
    });
});

export const locationController = {
    create,
    getAll,
    search,
    getById,
    getByCode,
    update,
    block,
    unblock,
    softDelete,
    restore,
};