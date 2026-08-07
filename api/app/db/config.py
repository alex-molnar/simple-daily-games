import os

def load_config():
    config = {
        'host': os.getenv('POSTGRES_HOSTNAME', 'host.docker.internal'),
        'database': os.getenv('POSTGRES_DB', 'simple-daily-games'),
        'user': os.getenv('POSTGRES_USER', 'simple-daily-games'),
        'password': os.getenv('POSTGRES_PASSWORD', 'password'),
        'port': os.getenv('POSTGRES_PORT', 5432)
    }
    return config


if __name__ == '__main__':
    config = load_config()
    print(config)