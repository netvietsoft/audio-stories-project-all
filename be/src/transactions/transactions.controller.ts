import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller('transactions')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    @Get('payments')
    findAllPayments(@Query() query: TransactionQueryDto) {
        return this.transactionsService.findAllPayments(query);
    }

    @Get('stats')
    getStats() {
        return this.transactionsService.getPaymentStats();
    }
}
