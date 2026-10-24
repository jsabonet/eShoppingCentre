from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="blogpost",
            name="read_time",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AlterField(
            model_name="blogpost",
            name="is_published",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="blogpost",
            name="published_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
