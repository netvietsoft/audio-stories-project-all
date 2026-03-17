import { Controller, Get, Query, UseGuards, Delete, Param, Post, Body } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { DonateDto } from './dto/donate.dto';
import { Account } from '@/auth/decorators/account.decorator';
import { JwtAccessGuard } from '@/auth/guards/jwt-access.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller('transactions')
@UseGuards(JwtAccessGuard)
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    private userIdFromAccount(account: any) {
        return account?.id || account?.sub;
    }

    @Get('my')
    findMyTransactions(@Account() account: any, @Query('page') page?: string, @Query('limit') limit?: string) {
        return this.transactionsService.findMyTransactions(
            this.userIdFromAccount(account),
            Number(page) || 1,
            Number(limit) || 20,
        );
    }

    @Post('donate')
    donate(@Account() account: any, @Body() dto: DonateDto) {
        return this.transactionsService.donateCredits(
            this.userIdFromAccount(account),
            dto.amount,
            dto.description,
        );
    }

    @Get('gifts')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    findAllGifts(@Query() query: TransactionQueryDto) {
        return this.transactionsService.findAllGifts(query);
    }

    @Get('payments')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    findAllPayments(@Query() query: TransactionQueryDto) {
        return this.transactionsService.findAllPayments(query);
    }

    @Get('stats')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    getStats() {
        return this.transactionsService.getPaymentStats();
    }

    @Delete('payments/:id')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    deletePayment(@Param('id') id: string) {
        return this.transactionsService.deletePayment(id);
    }
}
