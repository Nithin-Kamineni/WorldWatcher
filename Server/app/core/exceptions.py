"""App-wide exception handlers so DB errors never leak as raw tracebacks
or bare-text 500s - the frontend always gets consistent JSON."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError, IntegrityError, SQLAlchemyError


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(IntegrityError)
    async def handle_integrity_error(request: Request, exc: IntegrityError):
        detail = str(exc.orig) if exc.orig else str(exc)
        return JSONResponse(status_code=409, content={"detail": "Database constraint violated", "error": detail})

    @app.exception_handler(DataError)
    async def handle_data_error(request: Request, exc: DataError):
        detail = str(exc.orig) if exc.orig else str(exc)
        return JSONResponse(status_code=400, content={"detail": "Invalid data for one or more fields", "error": detail})

    @app.exception_handler(SQLAlchemyError)
    async def handle_sqlalchemy_error(request: Request, exc: SQLAlchemyError):
        return JSONResponse(status_code=500, content={"detail": "Database error", "error": str(exc)})

    @app.exception_handler(Exception)
    async def handle_uncaught(request: Request, exc: Exception):
        return JSONResponse(status_code=500, content={"detail": "Internal server error", "error": str(exc)})
