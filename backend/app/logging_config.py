import logging
import os


def configure_application_logging() -> logging.Logger:
    """Configures consistent ThunderDraft application logging."""

    configured_level = os.getenv(
        "THUNDERDRAFT_LOG_LEVEL",
        "INFO",
    ).upper()

    log_level = getattr(
        logging,
        configured_level,
        logging.INFO,
    )

    logger = logging.getLogger(
        "thunderdraft",
    )

    logger.setLevel(log_level)
    logger.propagate = False

    # Prevents duplicate handlers after repeated imports.
    if not logger.handlers:
        console_handler = logging.StreamHandler()

        console_handler.setFormatter(
            logging.Formatter(
                (
                    "%(asctime)s | %(levelname)s | "
                    "%(name)s | %(message)s"
                ),
            ),
        )

        logger.addHandler(
            console_handler,
        )

    return logger
